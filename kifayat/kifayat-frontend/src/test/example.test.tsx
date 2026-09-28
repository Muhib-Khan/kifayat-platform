import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CodPromise } from '../components/trust/CodPromise'

describe('CodPromise Component', () => {
  it('renders COD trust messaging correctly', () => {
    render(<CodPromise />)
    
    // Check that main elements are present
    expect(screen.getByText(/Cash on Delivery/i)).toBeInTheDocument()
    expect(screen.getByText(/Pay in cash when your order arrives/i)).toBeInTheDocument()
  })

  it('renders all trust items', () => {
    render(<CodPromise />)
    
    // Check for key trust messaging
    expect(screen.getByText(/No advance payment, ever/i)).toBeInTheDocument()
    expect(screen.getByText(/Check the product, then pay/i)).toBeInTheDocument()
    expect(screen.getByText(/Online payment accepted by courier/i)).toBeInTheDocument()
  })
})