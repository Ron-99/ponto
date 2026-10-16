"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid max-w-lg gap-3">
      <h2 className="text-lg font-semibold">Não foi possível carregar os dados</h2>
      <p className="text-muted-foreground">
        Em produção, o detalhe do erro aparece nos logs do servidor (na Vercel: Logs do projeto).
        Verifique se o banco está configurado.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">Código: {error.digest}</p>
      )}
      <Button className="w-fit" onClick={() => retry()}>
        Tentar de novo
      </Button>
    </div>
  );
}
