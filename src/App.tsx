import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HandbookPage, HomePage } from './Home'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/handbook" element={<HandbookPage />} />
      </Routes>
    </BrowserRouter>
  )
}
