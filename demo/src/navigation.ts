export function useRouter() { return { push: (href: string) => { window.location.assign(href); } }; }
