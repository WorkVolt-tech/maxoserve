import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

const PREP_LOCATIONS = ['kitchen', 'bar', 'bottle_service']

export default function AdminMenuItems() {
  const { categoryId } = useParams()
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [category, setCategory] = useState(null)
  const [items, setItems] = useState([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [prepLocation, setPrepLocation] = useState('kitchen')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadInitial()
  }, [categoryId])

  async function loadInitial() {
    setLoading(true)

    const { data: membership } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      setLoading(false)
      return
    }

    setBusinessId(membership.business_id)

    const { data: catData } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('id', categoryId)
      .single()
    setCategory(catData)

    await loadItems()
    setLoading(false)
  }

  async function loadItems() {
    const { data, error: itemsError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('category_id', categoryId)
      .order('display_order', { ascending: true })

    if (itemsError) {
      setError(itemsError.message)
    } else {
      setItems(data)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')

    const { error: insertError } = await supabase.from('menu_items').insert({
      business_id: businessId,
      category_id: categoryId,
      name,
      description: description || null,
      price: parseFloat(price) || 0,
      prep_location: prepLocation,
      display_order: items.length,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    setDescription('')
    setPrice('')
    setPrepLocation('kitchen')
    loadItems()
  }

  async function handleToggleAvailable(item) {
    await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id)
    loadItems()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this item?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    loadItems()
  }

  if (loading) return <div><h2>Menu Items</h2><p>Loading...</p></div>

  return (
    <div>
      <a href="/admin/menu" style={styles.backLink}>← Back to Categories</a>
      <h2>{category?.name || 'Items'}</h2>
      <p style={{ color: '#666' }}>Add items to this category.</p>

      <form onSubmit={handleAdd} style={styles.form}>
        <input
          type="text"
          placeholder="Item name (e.g. Loaded Nachos)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={styles.input}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          style={{ ...styles.input, flex: '0 1 120px' }}
        />
        <select value={prepLocation} onChange={(e) => setPrepLocation(e.target.value)} style={styles.select}>
          {PREP_LOCATIONS.map((p) => (
            <option key={p} value={p}>{p.replace('_', ' ')}</option>
          ))}
        </select>
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={styles.textarea}
        />
        <button type="submit" style={styles.button}>Add Item</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

      <div style={styles.list}>
        {items.length === 0 && <p style={{ color: '#888' }}>No items yet in this category.</p>}
        {items.map((item) => (
          <div key={item.id} style={styles.card}>
            <div>
              <strong>{item.name}</strong>
              <span style={styles.price}>${Number(item.price).toFixed(2)}</span>
              {item.description && <p style={styles.description}>{item.description}</p>}
              <span style={styles.meta}>{item.prep_location.replace('_', ' ')}</span>
              {!item.is_available && <span style={styles.inactiveBadge}>unavailable</span>}
            </div>
            <div style={styles.cardActions}>
              <button onClick={() => handleToggleAvailable(item)} style={styles.toggleButton}>
                {item.is_available ? 'Mark Unavailable' : 'Mark Available'}
              </button>
              <button onClick={() => handleDelete(item.id)} style={styles.deleteButton}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  backLink: { color: '#4c8dff', textDecoration: 'none', fontSize: '0.9rem' },
  form: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    marginTop: '1rem',
  },
  input: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
    flex: '1 1 200px',
  },
  select: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
  },
  textarea: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
    width: '100%',
    minHeight: '60px',
    fontFamily: 'system-ui, sans-serif',
  },
  button: {
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4c8dff',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: '#fff',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  price: { marginLeft: '0.6rem', color: '#4c8dff', fontWeight: 700 },
  description: { margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem', maxWidth: '400px' },
  meta: { color: '#888', fontSize: '0.8rem', marginRight: '0.5rem' },
  inactiveBadge: {
    fontSize: '0.75rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    background: '#fce4ec',
    color: '#c2185b',
  },
  cardActions: { display: 'flex', gap: '0.5rem', flexShrink: 0 },
  toggleButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#555',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  deleteButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#d33',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
}
