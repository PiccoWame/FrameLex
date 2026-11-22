import 'dotenv/config';
import express from 'express';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getFirebaseAdminAuth() {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
    projectId?: string;
  };
  if (!rawConfig.projectId || rawConfig.projectId === 'remixed-project-id') {
    throw new HttpError(500, 'Firebase project is not configured.');
  }
  const adminApp = getApps().length
    ? getApp()
    : initializeApp({ projectId: rawConfig.projectId });
  return getAuth(adminApp);
}

async function verifyFirebaseBearer(
  req: express.Request
): Promise<{ uid: string; email?: string }> {
  const authHeader = req.header('authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch?.[1]) {
    throw new HttpError(401, 'Sign in required. Please log in to use FrameLex.');
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(bearerMatch[1].trim());
    if (!decoded.uid) {
      throw new HttpError(401, 'Authenticated account UID missing.');
    }
    if (decoded.email_verified !== true) {
      throw new HttpError(
        403,
        'Please verify your email address before running FrameLex AI tools.'
      );
    }
    return { uid: decoded.uid, email: decoded.email };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, 'Invalid or expired sign-in session. Please sign in again.');
  }
}

function maskApiKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

async function resolveGeminiClient(
  req: express.Request
): Promise<{ ai: GoogleGenAI; uid: string; keyPreview: string }> {
  const account = await verifyFirebaseBearer(req);

  const rawPersonalKey = req.header('x-user-gemini-key')?.trim();
  if (!rawPersonalKey) {
    throw new HttpError(
      403,
      'A personal Gemini API key is required for your account. Enter and save your API key in Account Settings.'
    );
  }

  if (
    rawPersonalKey.length < 20 ||
    rawPersonalKey.length > 256 ||
    /\s/.test(rawPersonalKey)
  ) {
    throw new HttpError(400, 'Personal API key format appears invalid.');
  }

  return {
    ai: new GoogleGenAI({
      apiKey: rawPersonalKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    }),
    uid: account.uid,
    keyPreview: maskApiKey(rawPersonalKey),
  };
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }
  const err = error as { status?: number; message?: string };
  const msg = err?.message || 'Unexpected error communicating with Gemini API.';
  if (msg.includes('API_KEY_INVALID') || err?.status === 400) {
    return {
      status: 400,
      message:
        'Your personal account Gemini API key was rejected as invalid. Check or update it in your Account & API Key settings.',
    };
  }
  if (msg.includes('PERMISSION_DENIED') || err?.status === 403) {
    return {
      status: 403,
      message:
        'Your personal account Gemini API key lacks permission for this model. Verify billing or API access in Google AI Studio and update your key if needed.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
    return {
      status: 429,
      message:
        'Your Gemini API key rate limit or quota was reached. Please wait a moment or check your quota in Google AI Studio.',
    };
  }
  return { status: err?.status && err.status >= 400 ? err.status : 500, message: msg };
}

function isBlockedIpAddress(rawIp: string): boolean {
  const ip = rawIp.toLowerCase();
  if (ip.startsWith('::ffff:')) {
    return isBlockedIpAddress(ip.slice(7));
  }
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    const normalized = ip.split('%')[0];
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true;
    }
    return false;
  }
  return false;
}

function isBlockedPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.localhost')
  ) {
    return true;
  }
  if (net.isIP(lower)) {
    return isBlockedIpAddress(lower);
  }
  return false;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HttpError(400, 'Invalid URL format.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'Only HTTP and HTTPS image URLs are supported.');
  }

  if (parsed.username || parsed.password) {
    throw new HttpError(400, 'URLs containing embedded credentials are not supported.');
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!host || isBlockedPrivateHost(host)) {
    throw new HttpError(400, 'Private or local network URLs cannot be fetched.');
  }

  if (!net.isIP(host)) {
    try {
      const resolved = await dns.lookup(host, { all: true });
      if (!resolved.length || resolved.some((entry) => isBlockedIpAddress(entry.address))) {
        throw new HttpError(400, 'Remote host resolved to a restricted network address.');
      }
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, 'Could not resolve remote image hostname.');
    }
  }

  return parsed;
}

function safeParseModelJson<T>(rawText: string): T {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

const app = express();
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'framelex',
    timestamp: Date.now(),
  });
});

app.post('/api/fetch-image-url', async (req, res) => {
  try {
    await verifyFirebaseBearer(req);
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl || rawUrl.length > 2048) {
      res.status(400).json({ error: 'Please provide a valid image URL.' });
      return;
    }

    let targetUrl = await assertSafePublicUrl(rawUrl);
    let upstream: Response | null = null;

    for (let hop = 0; hop <= 3; hop += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        upstream = await fetch(targetUrl.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            Accept: 'image/*',
          },
        });
      } finally {
        clearTimeout(timeout);
      }

      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location');
        if (!location || hop === 3) {
          throw new HttpError(400, 'Too many or invalid redirects while fetching image.');
        }
        const resolvedRedirect = new URL(location, targetUrl).toString();
        targetUrl = await assertSafePublicUrl(resolvedRedirect);
        continue;
      }
      break;
    }

    if (!upstream || !upstream.ok) {
      res.status(400).json({
        error: `Image server returned HTTP ${upstream?.status ?? 'error'}.`,
      });
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      res.status(400).json({ error: 'URL did not return an image MIME type.' });
      return;
    }

    const arrayBuffer = await upstream.arrayBuffer();
    if (arrayBuffer.byteLength > 12 * 1024 * 1024) {
      res.status(400).json({ error: 'Remote image exceeds 12 MB limit.' });
      return;
    }

    const mimeType = contentType.split(';')[0].trim();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    res.json({ base64, mimeType });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    const isAbort = error instanceof Error && error.name === 'AbortError';
    res.status(isAbort ? 504 : 500).json({
      error: isAbort
        ? 'Timed out while downloading the remote image.'
        : 'Failed to fetch remote image.',
    });
  }
});

app.post('/api/verify-api-key', async (req, res) => {
  try {
    const resolved = await resolveGeminiClient(req);
    await resolved.ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: 'Reply with OK.',
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    res.json({ valid: true, keyPreview: resolved.keyPreview });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

app.post('/api/analyze-image', async (req, res) => {
  try {
    await verifyFirebaseBearer(req);
    const {
      imageBase64,
      mimeType,
      detailLevel = 'balanced',
      complexity,
      focusBias = 'full',
      aspectRatio = '4:3',
      customNotes = '',
      sampledColors = [],
    } = req.body ?? {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Missing image data.' });
      return;
    }
    if (!mimeType || typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
      res.status(400).json({ error: 'Unsupported or missing image MIME type.' });
      return;
    }

    const rawComplexity =
      typeof complexity === 'number' && Number.isFinite(complexity)
        ? Math.round(complexity)
        : detailLevel === 'concise'
          ? 3
          : detailLevel === 'exhaustive'
            ? 10
            : 7;
    const clampedComplexity = Math.max(1, Math.min(10, rawComplexity));

    const resolved = await resolveGeminiClient(req);
    const ai = resolved.ai;

    let complexityDirective = '';
    if (clampedComplexity <= 2) {
      complexityDirective =
        'Complexity 1-2/10 (Essential Core): Focus strictly on the primary subject, main setting, dominant lighting direction, and medium without secondary background minutiae.';
    } else if (clampedComplexity <= 4) {
      complexityDirective =
        'Complexity 3-4/10 (Crisp Structured): Provide clear, focused specificity covering framing, subject posture, primary spatial field, lighting quality, and tonal palette.';
    } else if (clampedComplexity <= 6) {
      complexityDirective =
        'Complexity 5-6/10 (Balanced Multi-Plane): Provide structured multi-plane detail covering optical framing, depth planes, leading lines, material finishes, light temperature, and color harmony.';
    } else if (clampedComplexity <= 8) {
      complexityDirective =
        'Complexity 7-8/10 (Granular Systematic): Provide deep, organized reverse-engineering with NO word count or character count limitations. Let the visual richness of the image dictate full length. Systematically document foreground/midground/background fields, frame edge margins, directional routes and leading lines, surface traces (wear, folds, grain, reflections), shadow penumbra, and nuanced tonal grading.';
    } else {
      complexityDirective =
        'Complexity 9-10/10 (Unrestricted Forensic Exhaustive): Provide maximum microscopic, forensic visual precision with ZERO word count limits and ZERO character count limits—expand as long and detailed as the image demands without truncation or artificial brevity. Leave no visible detail unrecorded: inspect frame boundaries and negative space, every foreground-to-background spatial field and visual route, every subtle trace (micro-scratches, dust, patina, fabric weave, condensation, wear marks, specular glints, edge highlights), camera pitch/focal length/DOF falloff, key/fill/bounce light Kelvin temperatures and shadow penumbra, and exact highlight/midtone/shadow tonal shifts.';
    }

    const focusDirective =
      focusBias === 'photography'
        ? 'Analytical Emphasis — Optical & Lighting Physics: Prioritize focal length, aperture bokeh falloff, sensor/film emulsion grain, key/fill/rim Kelvin temperature ratios, specular roll-off, and contact shadows.'
        : focusBias === 'style'
          ? 'Analytical Emphasis — Medium & Surface Craft: Prioritize artistic substrate, pigment density, brush/ink stroke direction, paper tooth, rendering shader behavior, and surface patina.'
          : focusBias === 'composition'
            ? 'Analytical Emphasis — Spatial Geometry & Routes: Prioritize foreground-midground-background fields, leading lines, vanishing routes, occlusion hierarchy, frame edge tension, and negative space.'
            : 'Analytical Emphasis — Balanced Forensic Inventory: Give disciplined, proportional depth across framing, subject micro-details, spatial fields/routes, surface traces, lighting physics, and tonal grading.';

    const paletteContext =
      Array.isArray(sampledColors) && sampledColors.length > 0
        ? `Measured dominant image hex swatches (from pixel sampling): ${sampledColors
            .filter((c): c is string => typeof c === 'string')
            .slice(0, 8)
            .join(', ')}. Reference these real tonal relationships accurately when describing color harmony, highlights, midtones, and shadows.`
        : '';

    const extraNotes =
      typeof customNotes === 'string' && customNotes.trim().length > 0
        ? `User emphasis notes: "${customNotes.trim()}"`
        : '';

    const systemInstruction = `You are a forensic visual reverse-engineering specialist and director of photography. Your job is to inspect the image with extreme, microscopic accuracy and convert every visible observation into an organized, systemized prompt architecture.

Rules of observation:
- Do NOT enforce any word count or character count ceiling. Complex or richly textured images should yield thorough, comprehensive, long-form prompts; never compress or omit visible details to meet a short target.
- Describe ONLY what is genuinely observable in the frame. Never pad with cliché buzzwords ("masterpiece", "8k", "award winning", "trending on artstation", "ultra realistic") unless the image's literal medium/style requires a specific technical descriptor.
- Account systematically for: (1) Framing & optical geometry (shot scale, camera height/angle, lens focal length, depth-of-field plane, frame edges), (2) Primary subject & micro-pose/expression, (3) Spatial fields, depth planes & visual routes (foreground, midground, background, leading lines, vanishing trajectories), (4) Minute surface traces & materiality (wear, patina, folds, weave, dust, scratches, reflections, moisture, edge textures), (5) Lighting physics & shadow traces (key direction, Kelvin warmth/coolness, fill bounce, rim separation, shadow edge softness), and (6) Color architecture & tones (highlight tint, midtone bias, shadow depth, tonal contrast, medium/grain).
- Organize every generated prompt in a clean, logical sequence rather than a random list of adjectives.

${complexityDirective}
${focusDirective}
${paletteContext}
${extraNotes}
Detected image aspect ratio: ${aspectRatio}.

Generate:
1. A concise 3-6 word descriptive title.
2. Eight granular, organized anatomy fields (subject, spatialFields, environment, composition, lighting, colorHarmony, surfaceTraces, mediumStyle) plus concrete negativePrompt exclusions. Each anatomy field should hold crisp, high-signal granular observations corresponding to Complexity ${clampedComplexity}/10 with no artificial truncation.
3. 10-14 atomic visual descriptor keywords (2-5 words each) capturing specific micro-details, lighting cues, textures, and spatial routes.
4. Five generator-ready dialect prompts organized cleanly at Complexity ${clampedComplexity}/10 with no length caps:
   - general: Systematically structured descriptive prose (Framing & Subject -> Spatial Fields & Routes -> Surface Traces -> Lighting & Tonal Grade -> Medium) ideal for Imagen / Gemini / GPT Image.
   - midjourney: Organized comma-separated visual clauses ordered from primary subject & micro-details -> spatial planes & routes -> surface traces -> lighting & color tones -> optics/medium, ending with "--ar ${aspectRatio}".
   - flux: Spatial and optical-physics prose emphasizing lens geometry, surface micro-texture, tonal grading, and natural light falloff without weighted brackets or spam tags.
   - sdxl: Organized weighted semantic clusters such as (primary subject & micro-details:1.2), (spatial field & leading routes:1.1), surface/material traces, lighting physics, tonal grading, optical/medium descriptors.
   - video: Motion-ready prompt inferring plausible camera trajectory (dolly, pan, tilt, locked tripod) plus subtle physical motion of subject, light flicker, reflections, or atmospheric drift grounded in the still frame.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text: `Perform a Complexity ${clampedComplexity}/10 forensic visual reverse-engineering extraction across all fields, frame boundaries, spatial routes, surface traces, lighting physics, and tonal nuances.`,
          },
        ],
      },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Short 3-6 word descriptive title.' },
            anatomy: {
              type: Type.OBJECT,
              properties: {
                subject: {
                  type: Type.STRING,
                  description: 'Primary subject, anatomical pose, gaze, garment tension, and focal micro-details.',
                },
                spatialFields: {
                  type: Type.STRING,
                  description: 'Foreground/midground/background depth planes, leading lines, vanishing routes, occlusion, and frame margins.',
                },
                environment: {
                  type: Type.STRING,
                  description: 'Architectural or natural setting, secondary props, and contextual surroundings.',
                },
                composition: {
                  type: Type.STRING,
                  description: 'Shot scale, camera elevation/pitch, focal length feel, aperture depth of field, and geometric balance.',
                },
                lighting: {
                  type: Type.STRING,
                  description: 'Key/fill/rim light angles, Kelvin temperature, specular roll-off, shadow edge hardness, and atmospheric scatter.',
                },
                colorHarmony: {
                  type: Type.STRING,
                  description: 'Highlight, midtone, and shadow color tones, saturation balance, contrast curve, and tonal interplay.',
                },
                surfaceTraces: {
                  type: Type.STRING,
                  description: 'Minute surface textures, wear marks, patina, dust, fabric weave, scratches, condensation, or specular micro-traces.',
                },
                mediumStyle: {
                  type: Type.STRING,
                  description: 'Capture medium, film stock/grain, sensor response, brushwork, ink lineweight, or rendering finish.',
                },
                negativePrompt: {
                  type: Type.STRING,
                  description: 'Comma-separated artifacts, distortions, or unwanted styles to exclude.',
                },
              },
              required: [
                'subject',
                'spatialFields',
                'environment',
                'composition',
                'lighting',
                'colorHarmony',
                'surfaceTraces',
                'mediumStyle',
                'negativePrompt',
              ],
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '10-14 atomic visual descriptor tokens.',
            },
            dialects: {
              type: Type.OBJECT,
              properties: {
                general: { type: Type.STRING },
                midjourney: { type: Type.STRING },
                flux: { type: Type.STRING },
                sdxl: { type: Type.STRING },
                video: { type: Type.STRING },
              },
              required: ['general', 'midjourney', 'flux', 'sdxl', 'video'],
            },
          },
          required: ['title', 'anatomy', 'keywords', 'dialects'],
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      res.status(502).json({ error: 'Model returned an empty response.' });
      return;
    }

    const parsed = safeParseModelJson<Record<string, unknown>>(rawText);
    res.json(parsed);
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

app.post('/api/refine-prompt', async (req, res) => {
  try {
    await verifyFirebaseBearer(req);
    const {
      currentPrompt,
      dialect = 'general',
      instruction,
      imageBase64,
      mimeType,
    } = req.body ?? {};

    if (!currentPrompt || typeof currentPrompt !== 'string') {
      res.status(400).json({ error: 'Missing current prompt text.' });
      return;
    }
    if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
      res.status(400).json({ error: 'Please provide a refinement instruction.' });
      return;
    }

    const resolved = await resolveGeminiClient(req);
    const ai = resolved.ai;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (imageBase64 && mimeType && typeof imageBase64 === 'string' && typeof mimeType === 'string') {
      parts.push({
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      });
    }
    parts.push({
      text: `Current ${dialect} prompt:\n"""\n${currentPrompt}\n"""\n\nRefinement instruction: "${instruction.trim()}"\n\nUpdate the prompt to apply the instruction while preserving the core subject and appropriate ${dialect} syntax.`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction:
          'You are an expert prompt editor. Rewrite the provided prompt cleanly according to the user instruction, maintaining proper syntax for the requested generator dialect. Return JSON with updatedPrompt and a 1-sentence summary of what changed.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            updatedPrompt: { type: Type.STRING },
            changeSummary: { type: Type.STRING },
          },
          required: ['updatedPrompt', 'changeSummary'],
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      res.status(502).json({ error: 'Model returned an empty refinement.' });
      return;
    }
    res.json(safeParseModelJson<Record<string, unknown>>(rawText));
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

app.post('/api/enhance-prompt', async (req, res) => {
  try {
    await verifyFirebaseBearer(req);
    const {
      currentPrompt,
      dialect = 'general',
      anatomy,
      aspectRatio = '4:3',
      sampledColors = [],
      imageBase64,
      mimeType,
    } = req.body ?? {};

    if (!currentPrompt || typeof currentPrompt !== 'string') {
      res.status(400).json({ error: 'Missing prompt text to enhance.' });
      return;
    }

    const resolved = await resolveGeminiClient(req);
    const ai = resolved.ai;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (imageBase64 && mimeType && typeof imageBase64 === 'string' && typeof mimeType === 'string') {
      parts.push({
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      });
    }

    const anatomyContext =
      anatomy && typeof anatomy === 'object'
        ? `\nExtracted Visual Anatomy:\n${JSON.stringify(anatomy, null, 2)}`
        : '';
    const colorContext =
      Array.isArray(sampledColors) && sampledColors.length > 0
        ? `\nMeasured Pixel Palette Hexes: ${sampledColors.slice(0, 8).join(', ')}`
        : '';

    const dialectRules =
      dialect === 'midjourney'
        ? `Format strictly for Midjourney: clean, high-density, professionally ordered comma-separated clauses (Framing & Lens -> Subject & Micro-Details -> Spatial Fields & Routes -> Surface Traces -> Lighting & Color Tones -> Medium), preserving or refining flags such as --ar ${aspectRatio}.`
        : dialect === 'sdxl'
          ? 'Format strictly for Stable Diffusion XL: disciplined weighted semantic clusters like (primary subject & micro-detail:1.2), (spatial architecture & route:1.1), surface/material tokens, lighting physics, tonal curve, optics/medium, plus an upgraded comma-separated negative prompt.'
          : dialect === 'flux'
            ? 'Format strictly for Flux.1: deeply articulate, structured natural-language prose organized across clear visual sections/paragraphs (Optical Framing & Subject, Spatial Fields & Leading Routes, Materiality & Surface Traces, Lighting Physics & Shadow Falloff, Color Grading & Medium) with zero weighted brackets.'
            : dialect === 'video'
              ? 'Format strictly for AI Video (Veo / Runway / Sora): structured production shot sheet detailing Camera Trajectory & Optics, Subject Micro-Action, Environmental & Atmospheric Motion, Surface Light Reflections, and Color/Film Treatment.'
              : 'Format for General / Natural generators (Imagen / Gemini / GPT Image): organize the prompt into clean, professionally structured sections (Framing & Optical Geometry, Primary Subject & Micro-Details, Spatial Fields & Leading Routes, Surface Traces & Materiality, Lighting Physics & Shadow Falloff, Color Architecture & Medium) so it reads like a director of photography specification.';

    parts.push({
      text: `Current ${dialect} prompt:\n"""\n${currentPrompt}\n"""${anatomyContext}${colorContext}\n\nTransform and elevate this into a deeply detailed, professionally organized ${dialect} prompt. There are NO word count or character count limitations—expand every observed detail with precision and structural clarity.`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction: `You are a principal visual prompt architect and director of photography. Your task is to elevate, deepen, and professionally organize the provided prompt into production-grade specification quality.

Critical Guidelines:
- NO character count or word count limitations. Be as thorough, expansive, and granular as the image and anatomy warrant.
- If the reference image is attached, verify and enrich minute observations directly from the pixels: framing margins, depth planes, leading routes, surface wear/patina/traces, light falloff, shadow edges, and tonal relationships.
- Replace vague adjectives with concrete optical, material, spatial, and lighting terminology. Avoid empty AI buzzwords ("8k", "masterpiece", "trending on artstation").
- ${dialectRules}
- Return JSON with:
  - enhancedPrompt: the upgraded, professionally organized prompt.
  - enhancedNegativePrompt: refined artifact/style exclusions (for SDXL or general reference).
  - enhancementSummary: a concise 1-sentence summary of the structural and detail upgrades applied.`,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            enhancedPrompt: { type: Type.STRING },
            enhancedNegativePrompt: { type: Type.STRING },
            enhancementSummary: { type: Type.STRING },
          },
          required: ['enhancedPrompt', 'enhancedNegativePrompt', 'enhancementSummary'],
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      res.status(502).json({ error: 'Model returned an empty enhancement.' });
      return;
    }
    res.json(safeParseModelJson<Record<string, unknown>>(rawText));
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

app.post('/api/suggest-variations', async (req, res) => {
  try {
    await verifyFirebaseBearer(req);
    const {
      currentPrompt,
      dialect = 'general',
      complexity = 8,
      anatomy,
      enabledLayers,
      aspectRatio = '4:3',
      sampledColors = [],
      imageBase64,
      mimeType,
    } = req.body ?? {};

    const hasPrompt = typeof currentPrompt === 'string' && currentPrompt.trim().length > 0;
    const hasAnatomy = anatomy && typeof anatomy === 'object';
    if (!hasPrompt && !hasAnatomy) {
      res.status(400).json({ error: 'Missing prompt or anatomy configuration to vary.' });
      return;
    }

    const resolved = await resolveGeminiClient(req);
    const ai = resolved.ai;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (imageBase64 && mimeType && typeof imageBase64 === 'string' && typeof mimeType === 'string') {
      parts.push({
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      });
    }

    const safeComplexity = Math.max(1, Math.min(10, Number(complexity) || 8));
    const anatomyContext = hasAnatomy
      ? `\nCurrent Modular Anatomy Configuration:\n${JSON.stringify(anatomy, null, 2)}`
      : '';
    const enabledContext =
      enabledLayers && typeof enabledLayers === 'object'
        ? `\nEnabled Layers: ${JSON.stringify(enabledLayers)}`
        : '';
    const colorContext =
      Array.isArray(sampledColors) && sampledColors.length > 0
        ? `\nReference Palette Hexes: ${sampledColors.slice(0, 8).join(', ')}`
        : '';

    const dialectRules =
      dialect === 'midjourney'
        ? `Format each fullPrompt in Midjourney syntax with comma-separated clauses and preserve flags like --ar ${aspectRatio}.`
        : dialect === 'sdxl'
          ? 'Format each fullPrompt in SDXL weighted tag syntax like (subject:1.15), lighting, texture, medium.'
          : dialect === 'flux'
            ? 'Format each fullPrompt in Flux.1 spatial & optical prose without weighted brackets.'
            : dialect === 'video'
              ? 'Format each fullPrompt as an AI Video motion prompt describing camera choreography and environmental motion.'
              : 'Format each fullPrompt in clean natural-language visual prose.';

    parts.push({
      text: `Current ${dialect} prompt (Complexity target ${safeComplexity}/10):
"""
${typeof currentPrompt === 'string' ? currentPrompt : ''}
"""${anatomyContext}${enabledContext}${colorContext}

Generate exactly 3 distinct stylistic variations that iterate on this anatomy configuration. Keep the core subject, pose, spatial fields, and environment intact while transforming the photographic/artistic direction (for example: one Cinematic direction, one Ethereal/Atmospheric direction, and one Gritty/Tactile or Editorial direction tailored naturally to this subject).`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction: `You are an expert visual director and prompt architect. Given a prompt and its 8-layer anatomy configuration, propose exactly 3 sharply differentiated stylistic iterations (such as "Cinematic", "Ethereal", "Gritty", or equally vivid 1-2 word style labels tailored to the scene).

Critical Rules:
- Preserve the user's primary subject, spatial planes, and environment so the scene identity stays recognizable.
- Transform the stylistic layers in anatomyPatch (composition, lighting, colorHarmony, surfaceTraces, mediumStyle, negativePrompt) with concrete optical, lighting physics, surface materiality, tonal grading, and emulsion/medium terminology.
- ${dialectRules}
- Keep styleNotes to 3 concise descriptors (e.g., "40mm anamorphic", "Teal & amber", "Vision3 500T").
- Avoid vague buzzwords like "masterpiece", "8k", or "trending on artstation".
- Return JSON with a "variations" array containing exactly 3 objects.`,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  styleLabel: {
                    type: Type.STRING,
                    description: 'Short 1-2 word style title such as Cinematic, Ethereal, or Gritty.',
                  },
                  tagline: {
                    type: Type.STRING,
                    description: 'Concise 1-sentence summary of the stylistic shift.',
                  },
                  styleNotes: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '3 concise optical, lighting, or medium cues.',
                  },
                  anatomyPatch: {
                    type: Type.OBJECT,
                    properties: {
                      composition: { type: Type.STRING },
                      lighting: { type: Type.STRING },
                      colorHarmony: { type: Type.STRING },
                      surfaceTraces: { type: Type.STRING },
                      mediumStyle: { type: Type.STRING },
                      negativePrompt: { type: Type.STRING },
                    },
                    required: [
                      'composition',
                      'lighting',
                      'colorHarmony',
                      'surfaceTraces',
                      'mediumStyle',
                      'negativePrompt',
                    ],
                  },
                  fullPrompt: { type: Type.STRING },
                },
                required: [
                  'id',
                  'styleLabel',
                  'tagline',
                  'styleNotes',
                  'anatomyPatch',
                  'fullPrompt',
                ],
              },
            },
          },
          required: ['variations'],
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      res.status(502).json({ error: 'Model returned an empty variations response.' });
      return;
    }

    const parsed = safeParseModelJson<{ variations?: unknown[] }>(rawText);
    const variations = Array.isArray(parsed.variations) ? parsed.variations.slice(0, 3) : [];
    if (variations.length === 0) {
      res.status(502).json({ error: 'No stylistic variations were generated. Please try again.' });
      return;
    }

    res.json({ variations });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

async function startServer() {
  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FrameLex server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
