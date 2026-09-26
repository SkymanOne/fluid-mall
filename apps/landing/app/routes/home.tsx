export function meta() {
  return [{ title: "Fluid" }];
}

export default function Home() {
  return (
    <main>
      <h1>Fluid</h1>
      <p>Shopping mall in your hands</p>
      <a href={import.meta.env.VITE_WEB_APP_URL}>Open Fluid</a>
      <p>On your phone, open Fluid in the browser and add it to your Home Screen.</p>
    </main>
  );
}
