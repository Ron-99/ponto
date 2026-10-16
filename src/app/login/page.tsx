import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page({ searchParams }: PageProps<"/login">) {
  return (
    <Card className="mx-auto mt-8 w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Informe a senha para acessar o seu ponto.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <LoginFormWithNext searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/"} />;
}
