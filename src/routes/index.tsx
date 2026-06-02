import { createFileRoute } from "@tanstack/react-router";

const Home = () => {
  return (
    <section className="galaxy__hero">
      <h1 className="galaxy__title">Memory Galaxy</h1>
      <p className="galaxy__tagline">A sky of stars, each one a memory.</p>
    </section>
  );
};

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
