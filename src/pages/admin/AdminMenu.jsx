import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminMenu() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadInitial()
  }, [])

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
    await loadCategories(membership.business_id)
    setLoading(false)
  }

  async function loadCategories(bizId) {
    const { data, error: catError } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('business_id', bizId)
      .order('display_order', { ascending: true })

    if (catError) {
      setError(catError.message)
    } else {
      setCategories(data)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')

    const { error: insertError } = await supabase.from('menu_categories').insert({
      business_id: businessId,
      name,
      display_order: categories.length,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    loadCategories(businessId)
  }

  async function handleToggleActive(category) {
    await supabase
      .from('menu_categories')
      .update({ is_active: !category.is_active })
      .eq('id', category.id)
    loadCategories(businessId)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this category? All items inside it will also be deleted.')) return
    const { error: deleteError } = await supabase.from('menu_categories').delete().eq('id', id)
    if (deleteError) {
      setError(`Could not delete category: ${deleteError.message}`)
      return
    }
    loadCategories(businessId)
  }

  if (loading) return <div><h2>Menu</h2><p>Loading...</p></div>

  return (
    <div>
      <h2>Menu Categories</h2>
      <p style={{ color: '#666' }}>
        Categories organize your menu (e.g. Appetizers, Cocktails, Bottles). Click a category to manage its items.
      </p>

      <form onSubmit={handleAdd} style={styles.form}>
        <input
          type="text"
          placeholder="Category name (e.g. Appetizers)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Add Category</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

      <div style={styles.list}>
        {categories.length === 0 && <p style={{ color: '#888' }}>No categories yet.</p>}
        {categories.map((cat) => (
          <div key={cat.id} style={styles.card}>
            <a href={`/admin/menu/${cat.id}`} style={styles.categoryLink}>
              <strong>{cat.name}</strong>
              {!cat.is_active && <span style={styles.inactiveBadge}>hidden</span>}
            </a>
            <div style={styles.cardActions}>
              <button onClick={() => handleToggleActive(cat)} style={styles.toggleButton}>
                {cat.is_active ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => handleDelete(cat.id)} style={styles.deleteButton}>
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
  form: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
  input: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
    flex: '1 1 220px',
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
    alignItems: 'center',
    background: '#fff',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  categoryLink: {
    color: '#1a1d23',
    textDecoration: 'none',
    flex: 1,
  },
  inactiveBadge: {
    marginLeft: '0.6rem',
    fontSize: '0.75rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    background: '#fce4ec',
    color: '#c2185b',
  },
  cardActions: { display: 'flex', gap: '0.5rem' },
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
