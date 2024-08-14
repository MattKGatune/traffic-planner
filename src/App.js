import React from 'react';
import './App.css';
import MyComponent from './MyComponent';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Karibuni Wasafiri!</h1>
        <p>This app allows users to plan trips ahead of time using traffic optimal 
          routes from Google Maps API. During my time in Nairobi in the summer of 2024, 
          I experienced many traffic delays which made it very difficult to be punctual. 
          This issue inspired me to create a solution.</p>
        <MyComponent />
      </header>
    </div>
  );
}

export default App;
