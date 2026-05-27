export type BackgroundRemoverWorkbenchCopy = {
  selectedFileEmpty: string;
  invalidTypeError: string;
  fileTooLargeError: string;
  openError: string;
  defaultProcessError: string;
  sizeBadge: string;
  uploadTitle: string;
  uploadDescription: string;
  chooseImage: string;
  fileHint: string;
  resultTitle: string;
  resultDescription: string;
  statuses: Record<string, string>;
  before: string;
  originalAlt: string;
  transparentPng: string;
  resultAlt: string;
  removing: string;
  runRemovalHint: string;
  emptyPreviewTitle: string;
  emptyPreviewDescription: string;
  tryAnotherImage: string;
  tryAnother: string;
  removeBackground: string;
  downloadPng: string;
};

export type BackgroundRemoverHomeCopy = {
  metadata: {
    title: string;
    description: string;
    keywords: readonly string[];
  };
  shell: {
    pricing: string;
    billing: string;
    footerDescription: string;
    productGroup: string;
    tool: string;
    trustGroup: string;
    privacyPolicy: string;
    termsOfService: string;
    copyrightSuffix: string;
  };
  hero: {
    badge: string;
    title: string;
    description: string;
    trustNotes: readonly string[];
  };
  preview: {
    before: string;
    transparentPng: string;
    backgroundRemoved: string;
  };
  beforeTransparent: {
    eyebrow: string;
    title: string;
    description: string;
  };
  useCases: {
    eyebrow: string;
    title: string;
    description: string;
    items: readonly string[];
  };
  privacy: {
    title: string;
    description: string;
  };
  cta: {
    title: string;
    description: string;
    button: string;
  };
  workbench: BackgroundRemoverWorkbenchCopy;
};

export type BackgroundRemoverHomeContent = Readonly<
  Record<string, BackgroundRemoverHomeCopy>
>;

export function resolveBackgroundRemoverHomeCopy(
  homeContent: unknown,
  locale: string
): BackgroundRemoverHomeCopy {
  const content = homeContent as BackgroundRemoverHomeContent | null;
  const copy = content?.[locale] ?? content?.en;
  if (!copy) {
    throw new Error('background-remover requires localized home content');
  }

  return copy;
}
