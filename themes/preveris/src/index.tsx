/**
 * Snapify
 * © 2026 Hamdi Ayari — hamdi.ayari@novalabs.tn
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import './styles.css';
import React from 'react';
import { defineTheme } from '@snapify/sdk/theme';
import { Layout } from './Layout';
import { Header } from './Header';
import { Footer } from './Footer';
import { NotFound, Post } from './Views';
import { HeroBlock, MarqueeBlock, PageHeaderBlock } from './blocks/HeaderBlocks';
import { DetailsBlock, HtmlBlock, ImageBlock, RichTextBlock, SlidesBlock, SpacerBlock, TableBlock, TextMediaBlock, VideoBlock } from './blocks/ContentBlocks';
import { CardsBlock, ChecklistBlock, FaqBlock, GalleryBlock, PanelsBlock, ShowcaseBlock, StatsBlock, StepsBlock, TestimonialsBlock } from './blocks/CollectionBlocks';
import { ContactFormBlock, CtaBlock, ProjectsBlock, SimulatorBlock } from './blocks/ConversionBlocks';

export default defineTheme({
  Layout,
  Header,
  Footer,
  Page: ({ children }) => <main>{children}</main>,
  Post,
  NotFound,
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
