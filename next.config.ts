import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // pdfkit lee sus fuentes estándar (.afm) con fs.readFileSync(__dirname + ...);
  // si el bundler lo empaqueta, __dirname deja de apuntar a su carpeta real y
  // falla con ENOENT. Se deja fuera del bundle para que use require() nativo.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
