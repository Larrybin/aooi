import React, { type ReactNode } from 'react';
import {
  parseFragment,
  type DefaultTreeAdapterTypes,
  type ParserError,
} from 'parse5';

type ParsedAdsterraSnippet =
  | {
      ok: true;
      node: ReactNode;
    }
  | {
      ok: false;
    };

export const adsterraSnippetLog = {
  error(message: string, meta?: unknown) {
    // eslint-disable-next-line no-console
    console.error(message, meta);
  },
};

const ATTRIBUTE_ALIASES: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  srcset: 'srcSet',
  crossorigin: 'crossOrigin',
  referrerpolicy: 'referrerPolicy',
  autocapitalize: 'autoCapitalize',
  autocomplete: 'autoComplete',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  playsinline: 'playsInline',
  contenteditable: 'contentEditable',
  httpequiv: 'httpEquiv',
};

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function parseStyleAttribute(value: string) {
  const style: Record<string, string> = {};

  for (const declaration of value.split(';')) {
    const trimmed = declaration.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    const property = trimmed.slice(0, separatorIndex).trim();
    const cssValue = trimmed.slice(separatorIndex + 1).trim();
    if (!property || !cssValue) {
      continue;
    }

    style[toCamelCase(property)] = cssValue;
  }

  return style;
}

function normalizeAttributeName(name: string) {
  const normalized = name.toLowerCase();
  return ATTRIBUTE_ALIASES[normalized] || normalized;
}

function isTextNode(
  node: DefaultTreeAdapterTypes.ChildNode
): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === '#text';
}

function isElementNode(
  node: DefaultTreeAdapterTypes.ChildNode
): node is DefaultTreeAdapterTypes.Element {
  return 'tagName' in node;
}

function isTemplateNode(
  node: DefaultTreeAdapterTypes.Element
): node is DefaultTreeAdapterTypes.Template {
  return node.nodeName === 'template';
}

function getElementChildren(node: DefaultTreeAdapterTypes.Element) {
  if (isTemplateNode(node)) {
    return node.content.childNodes;
  }

  return node.childNodes;
}

function createElementProps(node: DefaultTreeAdapterTypes.Element) {
  const props: Record<string, unknown> = {};

  for (const attr of node.attrs) {
    const name = normalizeAttributeName(attr.name);
    if (name === 'style') {
      props.style = parseStyleAttribute(attr.value);
      continue;
    }

    props[name] = attr.value === '' ? true : attr.value;
  }

  return props;
}

function renderNode(
  node: DefaultTreeAdapterTypes.ChildNode,
  key: string
): ReactNode {
  if (isTextNode(node)) {
    return node.value;
  }

  if (node.nodeName === '#comment' || node.nodeName === '#documentType') {
    return null;
  }

  if (!isElementNode(node)) {
    return null;
  }

  const props = {
    ...createElementProps(node),
    key,
  } as Record<string, unknown>;

  if (node.tagName === 'script') {
    const scriptBody = node.childNodes
      .filter(isTextNode)
      .map((child: DefaultTreeAdapterTypes.TextNode) => child.value)
      .join('');

    if (scriptBody) {
      props.dangerouslySetInnerHTML = {
        __html: scriptBody,
      };
    }

    return React.createElement(node.tagName, props);
  }

  const children = renderNodes(getElementChildren(node), key);
  return React.createElement(node.tagName, props, children);
}

function renderNodes(
  nodes: DefaultTreeAdapterTypes.ChildNode[],
  keyPrefix: string
): ReactNode[] {
  return nodes
    .map((node, index) => renderNode(node, `${keyPrefix}-${index}`))
    .filter((node) => node !== null);
}

function serializeParseErrors(errors: ParserError[]) {
  return errors.slice(0, 3).map((error) => ({
    code: error.code,
    line: error.startLine,
    col: error.startCol,
  }));
}

function logSnippetParseError(placement: string, errors: ParserError[]) {
  adsterraSnippetLog.error('ads: invalid Adsterra snippet disabled', {
    placement,
    errors: serializeParseErrors(errors),
  });
}

export function renderAdsterraSnippet(
  snippet: string,
  placement: string
): ParsedAdsterraSnippet {
  const normalizedSnippet = snippet.trim();
  if (!normalizedSnippet) {
    return { ok: false };
  }

  const errors: ParserError[] = [];
  const fragment = parseFragment(normalizedSnippet, {
    onParseError(error: ParserError) {
      errors.push(error);
    },
  });

  if (errors.length > 0) {
    logSnippetParseError(placement, errors);
    return { ok: false };
  }

  const children = renderNodes(fragment.childNodes, placement);
  if (children.length === 0) {
    return { ok: false };
  }

  return {
    ok: true,
    node: React.createElement(React.Fragment, null, ...children),
  };
}
