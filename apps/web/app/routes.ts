import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [index("routes/home.tsx"), route("preview", "routes/preview.tsx")] satisfies RouteConfig;
