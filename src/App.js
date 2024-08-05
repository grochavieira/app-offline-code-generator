// src/App.js
import React from 'react';
import './App.css';
import Upload from './components/Upload';
import CodeBlock from './components/CodeBlock';

function App() {
	return (
		<div className="App">
			<div className="header-title">
				App Offline Code Generator
			</div>
			<Upload/>
		</div>
	);
}

export default App;
