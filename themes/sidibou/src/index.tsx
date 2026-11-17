/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import './styles.css';
import React from 'react';
import { defineTheme } from '@snapify/sdk/theme';
import { Header } from './Header';
import { Footer } from './Footer';
import { Layout } from './Layout';
import { Post } from './Post';
import { NotFoundView } from './NotFound';
import { HeroBlock, MarqueeBlock, PageHeaderBlock } from './blocks/HeaderBlocks';
import { DetailsBlock, HtmlBlock, ImageBlock, RichTextBlock, SlidesBlock, SpacerBlock, TableBlock, TextMediaBlock, VideoBlock } from './blocks/ContentBlocks';
import { CardsBlock, ChecklistBlock, FaqBlock, GalleryBlock, PanelsBlock, ShowcaseBlock, StatsBlock, StepsBlock, TestimonialsBlock } from './blocks/CollectionBlocks';
import { ContactFormBlock, CtaBlock, ProjectsBlock, SimulatorBlock } from './blocks/ConversionBlocks';

export default defineTheme({
  Layout,
  Header: ({ path, navigate }) => <Header currentPath={path} onNavigate={navigate} />,
  Footer: ({ navigate, openCookies }) => <Footer onNavigate={navigate} onOpenCookies={openCookies} />,
  Page: ({ children }) => <div className="bg-white">{children}</div>,
  Post,
  NotFound: ({ navigate }) => <NotFoundView onNavigate={navigate} />,
  blocks: {
    hero: HeroBlock,
    pageHeader: PageHeaderBlock,
    richText: RichTextBlock,
    textMedia: TextMediaBlock,
    image: ImageBlock,
    video: VideoBlock,
    slides: SlidesBlock,
    cards: CardsBlock,
    showcase: ShowcaseBlock,
    steps: StepsBlock,
    stats: StatsBlock,
    cta: CtaBlock,
    panels: PanelsBlock,
    gallery: GalleryBlock,
    checklist: ChecklistBlock,
    faq: FaqBlock,
    marquee: MarqueeBlock,
    projects: ProjectsBlock,
    table: TableBlock,
    simulator: SimulatorBlock,
    contactForm: ContactFormBlock,
    details: DetailsBlock,
    testimonials: TestimonialsBlock,
    spacer: SpacerBlock,
    html: HtmlBlock,
  },
});
