import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ImageDown,
  Lock,
  Sparkles,
} from 'lucide-react';

import { BackgroundRemoverWorkbench } from './background-remover-workbench';

const useCases = [
  'Product image cutouts',
  'Transparent PNG maker',
  'Profile and catalog images',
  'Design-ready foregrounds',
];

const trustNotes = [
  'PNG, JPG, and WebP',
  'Transparent PNG output',
  'Images expire automatically',
];

function CheckerboardPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E6EBF2] bg-white shadow-sm">
      <div className="grid min-h-64 md:grid-cols-2">
        <div className="relative min-h-64 bg-[linear-gradient(135deg,#E6EEFF,#FFFFFF_44%,#F4F7FB)]">
          <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.12))]" />
          <div className="absolute right-12 bottom-10 h-32 w-24 rounded-t-full bg-[#334155]" />
          <div className="absolute right-20 bottom-8 h-10 w-20 rounded-full bg-[#0F172A]" />
          <div className="absolute bottom-8 left-10 h-24 w-32 rounded-md bg-white/80 shadow-sm" />
          <div className="absolute top-4 left-4 rounded-md bg-white px-3 py-1 text-xs font-medium text-[#334155] shadow-sm">
            Before
          </div>
        </div>
        <div className="relative min-h-64 bg-[linear-gradient(45deg,#E6EBF2_25%,transparent_25%),linear-gradient(-45deg,#E6EBF2_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#E6EBF2_75%),linear-gradient(-45deg,transparent_75%,#E6EBF2_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0]">
          <div className="absolute right-12 bottom-10 h-32 w-24 rounded-t-full bg-[#334155]" />
          <div className="absolute right-20 bottom-8 h-10 w-20 rounded-full bg-[#0F172A]" />
          <div className="absolute top-4 left-4 rounded-md bg-white px-3 py-1 text-xs font-medium text-[#334155] shadow-sm">
            Transparent PNG
          </div>
          <div className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-md bg-[#0F8A5F] px-3 py-1.5 text-xs font-medium text-white shadow-sm">
            <Check className="size-3" />
            Background removed
          </div>
        </div>
      </div>
    </div>
  );
}

export function BackgroundRemoverHome() {
  return (
    <div className="bg-[#FBFCFE] text-[#0F172A]">
      <section className="border-b border-[#E6EBF2] bg-[linear-gradient(180deg,#FFFFFF,#F4F7FB)]">
        <div className="container py-8 md:py-12 lg:py-14">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-[#D8E1F2] bg-white px-3 py-1 text-sm font-medium text-[#334155] shadow-sm">
              <Sparkles className="size-4 text-[#4F6EF7]" />
              Remove background, export transparent PNG
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-[#0F172A] sm:text-5xl lg:text-6xl">
              Background Remover
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[#334155] sm:text-xl">
              Upload a product photo, portrait, or design asset. Get a clean
              foreground cutout with transparent pixels in one PNG.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3 text-sm text-[#334155]">
            {trustNotes.map((note) => (
              <span
                key={note}
                className="inline-flex items-center gap-2 rounded-md border border-[#E6EBF2] bg-white px-3 py-2"
              >
                <BadgeCheck className="size-4 text-[#0F8A5F]" />
                {note}
              </span>
            ))}
          </div>

          <BackgroundRemoverWorkbench />
        </div>
      </section>

      <section className="container grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-16">
        <div>
          <p className="text-sm font-semibold tracking-normal text-[#4F6EF7] uppercase">
            Before / Transparent
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[#0F172A]">
            Make the result obvious before anyone uploads.
          </h2>
          <p className="mt-4 text-base leading-7 text-[#334155]">
            The workbench uses a checkerboard preview because that is the
            product: a subject cut out from its old background and ready for a
            catalog, marketplace, deck, or design canvas.
          </p>
        </div>
        <CheckerboardPreview />
      </section>

      <section className="border-y border-[#E6EBF2] bg-white">
        <div className="container grid gap-8 py-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:py-16">
          <div>
            <p className="text-sm font-semibold tracking-normal text-[#4F6EF7] uppercase">
              Use cases
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-[#0F172A]">
              Built for image cutouts, not a heavy editor.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#334155]">
              V1 stays narrow: upload one image, remove the background, download
              a transparent PNG. Batch tools and background replacement can
              wait.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {useCases.map((useCase) => (
              <div
                key={useCase}
                className="flex items-center gap-3 rounded-lg border border-[#E6EBF2] bg-[#F4F7FB] p-4"
              >
                <ImageDown className="size-5 text-[#4F6EF7]" />
                <span className="font-medium text-[#0F172A]">{useCase}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container grid gap-6 py-12 lg:grid-cols-2 lg:py-16">
        <div className="rounded-lg border border-[#E6EBF2] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-[#E6EEFF] text-[#4F6EF7]">
              <Lock className="size-6" />
            </div>
            <h2 className="text-2xl font-semibold text-[#0F172A]">
              Privacy-aware retention
            </h2>
          </div>
          <p className="mt-4 text-base leading-7 text-[#334155]">
            Uploaded images are used to create your transparent PNG result, not
            to train AI models. Results expire according to your plan.
          </p>
        </div>

        <div className="rounded-lg border border-[#D8E1F2] bg-[#0F172A] p-6 text-white shadow-sm">
          <h2 className="text-2xl font-semibold">
            More images to process each month?
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-300">
            Free users can try the workflow. Paid plans raise monthly volume,
            upload size, and retention for repeat product image work.
          </p>
          <Link
            href="/pricing"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] transition hover:bg-[#F4F7FB]"
          >
            View pricing
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
