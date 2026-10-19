// Liberar somente depois da integração do cadastro, login e sessões do Zelo.
export const PERSONAL_ACCOUNTS_ENABLED = false;
export function personalAccessUnavailable() {
  return Response.json(
    { error: "O controle pessoal será liberado após a integração do cadastro e login. Por enquanto, use a demonstração." },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}
