import type { AnchorHTMLAttributes } from 'react';
import { navigate } from './navigation';

export default function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...rest} href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}>{children}</a>;
}
