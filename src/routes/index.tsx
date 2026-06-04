import { createFileRoute } from "@tanstack/react-router";
import { GalaxyWithLoader } from "#/components/galaxy/AstroLoader/GalaxyWithLoader";

const Home = () => <GalaxyWithLoader />;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Memory Galaxy" },
      {
        name: "description",
        content:
          "A growing galaxy of memories — each star is a memory someone shared.",
      },
    ],
  }),
  component: Home,
});
