import { forwardRef, type AnchorHTMLAttributes } from "react";
const Link = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(function Link(props, ref) { return <a ref={ref} {...props} />; });
export default Link;
