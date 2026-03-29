import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage/HomePage';
import FitrepForm from './pages/FitrepForm/FitrepForm';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/fitrep" element={<FitrepForm />} />
    </Routes>
  );
}