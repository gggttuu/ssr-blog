import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from '../App';

const initialData = window.__INITIAL_DATA__ || {};
const container = document.getElementById('root');

hydrateRoot(container, <App initialData={initialData} />);
