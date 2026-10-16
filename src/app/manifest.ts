import type { MetadataRoute } from "next";

// `id` e `start_url` identificam o app instalado: mudar depois obriga a reinstalar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ponto · Banco de horas",
    short_name: "Ponto",
    description: "Registro de ponto pessoal com banco de horas",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
