import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HandbookPage, HomePage } from './Home'
import { PrepPage } from './prep/Prep'
import { SelectionShare } from './SelectionShare'

export default function App() {
  return (
    <BrowserRouter>
      <SelectionShare />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/handbook" element={<HandbookPage />} />
        <Route path="/prep" element={<PrepPage />} />
      </Routes>
    </BrowserRouter>
  )
}
