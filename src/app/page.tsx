export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-2xl font-bold text-primary">
        Next Design Tokens
      </h1>
      <p className="mb-6 text-secondary">
        Next.js + Tailwind v4 + Design Tokens (Figma Tokens Studio 연동)
      </p>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-secondary p-4">
          <p className="text-primary">bg-secondary</p>
        </div>
        <div className="rounded-lg bg-brand p-4">
          <p className="text-inverse">bg-brand</p>
        </div>
      </div>
      <p className="mt-8 text-sm text-secondary">
        토큰 수정:{" "}
        <code className="rounded bg-neutral-100 px-1">pnpm sync:tokens</code>{" "}
        (src/token/tokens.json 기준)
      </p>
    </main>
  );
}
