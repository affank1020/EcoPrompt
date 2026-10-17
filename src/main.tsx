import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [clicked, setClicked] = useState(false);

  return (
    <main>
      <h1>Hello!</h1>
      <p>{clicked ? 'You clicked the button!' : 'Your Chrome extension is working.'}</p>
      <button type="button" onClick={() => setClicked(true)}>
        Click me
      </button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
