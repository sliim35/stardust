import { createFileRoute } from "@tanstack/react-router";
import { GalaxyStage } from "#/components/galaxy/GalaxyStage";

const Home = () => <GalaxyStage />;

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
