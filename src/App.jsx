// 1. No imports for CSS or logos. Just React.
import { useState } from 'react'

function App() {
  // 2. We keep this counter just to prove React is working
  const [count, setCount] = useState(0)

  return (
    // 3. This is the blank white page with a tiny test button
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Garage Inventory</h1>
      <p>Setup is working! Count is: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Click me to test
      </button>
    </div>
  )
}

export default App