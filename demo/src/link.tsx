import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";

// A demonstração tem uma única página. Mantém os links acessíveis sem depender do Next.
const Link = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function Link({ href, onClick, ...props }, ref) {
    function click(event: MouseEvent<HTMLAnchorElement>) {
      onClick?.(event);
      if (
        href === "/" &&
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        event.preventDefault();
      }
    }

    return <a ref={ref} href={href} onClick={click} {...props} />;
  },
);

export default Link;
