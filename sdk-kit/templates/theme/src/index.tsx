import './styles.css';
import type { ReactNode } from 'react';
import { defineTheme } from '@snapify/sdk/theme';
import { Header } from './Header';
import { Footer } from './Footer';
import { NotFound, Post } from './Views';
import { CtaBlock, HeroBlock, ImageBlock, PageHeaderBlock, RichTextBlock } from './blocks';

function Layout({ children }: { children: ReactNode }) {
  return <div className="st-root min-h-screen bg-px-surface text-px-navy">{children}</div>;
}

/**
 * Un bloc sans rendu n’est pas affiché : ajoutez les autres types du constructeur
 * (textMedia, cards, faq, gallery, contactForm…) avant de publier le thème.
 */
export default defineTheme({
  Layout,
  Header,
  Footer,
  Post,
  NotFound,
  blocks: {
    hero: HeroBlock,
    pageHeader: PageHeaderBlock,
    richText: RichTextBlock,
    image: ImageBlock,
    cta: CtaBlock,
  },
});
