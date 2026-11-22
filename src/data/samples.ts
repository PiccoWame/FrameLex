import archImg from '../assets/images/sample_architecture_1794537596539.jpg';
import portraitImg from '../assets/images/sample_portrait_1794537596708.jpg';
import productImg from '../assets/images/sample_product_1794537597458.jpg';
import illustrationImg from '../assets/images/sample_illustration_1794537597488.jpg';

export interface SampleAsset {
  id: string;
  title: string;
  category: string;
  url: string;
}

export const SAMPLE_ASSETS: SampleAsset[] = [
  {
    id: 'arch',
    title: 'Concrete Courtyard',
    category: 'Architecture',
    url: archImg,
  },
  {
    id: 'portrait',
    title: 'Ceramicist Studio',
    category: 'Editorial Portrait',
    url: portraitImg,
  },
  {
    id: 'product',
    title: 'Manual 50mm Lens',
    category: 'Product Still Life',
    url: productImg,
  },
  {
    id: 'illustration',
    title: 'Cliff Observatory',
    category: 'Gouache & Ink',
    url: illustrationImg,
  },
];
