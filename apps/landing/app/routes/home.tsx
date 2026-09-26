export function meta() {
  return [{ title: "Fluid Mall" }];
}

export default function Home() {
  return (
    <main>
      <h1>Fluid Mall</h1>
      <a href={import.meta.env.VITE_WEB_APP_URL}>Open web app</a>
      <br />
      <a href={import.meta.env.VITE_IOS_APP_URL}>Download for iOS</a>
    </main>
  );
}
