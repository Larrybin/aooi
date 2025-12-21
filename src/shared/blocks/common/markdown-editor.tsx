'use client';

import { useEffect, useRef } from 'react';
import { OverType } from 'overtype';

type OverTypeInstance = ReturnType<(typeof OverType)['init']>[0];

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 400,
  showToolbar,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  showToolbar?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const editorRef = useRef<OverTypeInstance>(null);
  const initialOptionsRef = useRef({
    value,
    onChange,
    placeholder,
    minHeight,
    showToolbar,
  });

  useEffect(() => {
    const [instance] = OverType.init(ref.current, initialOptionsRef.current);
    editorRef.current = instance;

    return () => editorRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getValue()) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return (
    <div
      className="overflow-hidden rounded-md border"
      ref={ref}
      style={{ height: '400px' }}
    />
  );
}
