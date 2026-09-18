import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HandbookPage, HomePage } from './Home'
import { PrepPage } from './prep/Prep'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/handbook" element={<HandbookPage />} />
        <Route path="/prep" element={<PrepPage />} />
      </Routes>
    </BrowserRouter>
  )
}
