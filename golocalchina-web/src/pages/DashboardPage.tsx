import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, Button, Grid, Avatar, Chip,
  TextField, Alert, Tabs, Tab, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, IconButton,
  Rating
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HandshakeIcon from '@mui/icons-material/Handshake';
import RateReviewIcon from '@mui/icons-material/RateReview';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FavoriteIcon from '@mui/icons-material/Favorite';
import api from '../services/api';

const CITIES = ['Beijing', 'Shanghai', 'Xian', 'Chengdu', 'Guilin', 'Hangzhou'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState<any>({});
  const [listings, setListings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [saveMsg, setSaveMsg] = useState('');
  const [newListingOpen, setNewListingOpen] = useState(false);
  const [newListing, setNewListing] = useState({
    title: '', summary: '', description_md: '', city: 'Beijing',
    price_amount: 500, price_unit: 'per_half_day', cover_image_url: '', languages: 'en,zh',
    images: '', map_links: ''
  });
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewStars, setReviewStars] = useState<number>(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');

  const loadRequests = async () => {
    try {
      const res = await api.get('/service-requests/mine');
      setRequests(res.data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    }
  };

  const loadProfile = async () => {
    try {
      const res = await api.get('/profile/me');
      setProfile(res.data);
    } catch {
      const stored = localStorage.getItem('glc_user');
      if (stored) setProfile(JSON.parse(stored));
    }
  };

  const loadListings = async () => {
    try {
      const res = await api.get('/listings/mine');
      setListings(res.data);
    } catch {}
  };

  useEffect(() => {
    const stored = localStorage.getItem('glc_user');
    if (!stored) { navigate('/login'); return; }
    const u = JSON.parse(stored);
    setUser(u);
    loadProfile();
    loadRequests();
    if (u.role === 'guide') loadListings();
  }, [navigate]);

  const saveProfile = async () => {
    setSaveMsg('');
    try {
      if (user.role === 'tourist') {
        await api.put('/profile/me/tourist', {
          display_name: profile.display_name,
          nationality: profile.nationality,
          preferred_currency: profile.preferred_currency,
        });
      } else {
        await api.put('/profile/me/guide', {
          display_name: profile.display_name, bio: profile.bio,
          languages: typeof profile.languages === 'string' ? profile.languages.split(',').map((s: string) => s.trim()) : profile.languages,
          service_cities: typeof profile.service_cities === 'string' ? profile.service_cities.split(',').map((s: string) => s.trim()) : profile.service_cities,
          default_rate_cny: profile.default_rate_cny,
          alipay_qr_url: profile.alipay_qr_url, wechat_pay_qr_url: profile.wechat_pay_qr_url,
          payment_note: profile.payment_note,
        });
      }
      localStorage.setItem('glc_user', JSON.stringify({ ...user, display_name: profile.display_name, email: profile.email }));
      setSaveMsg('Profile saved!');
    } catch (err: any) {
      setSaveMsg('Failed: ' + (err?.response?.data?.detail || 'Unknown error'));
    }
  };

  const [listingError, setListingError] = useState('');

  const createListing = async () => {
    setListingError('');
    if (newListing.title.length < 5) { setListingError('Title must be at least 5 characters.'); return; }
    if (newListing.summary.length < 10) { setListingError('Summary must be at least 10 characters.'); return; }
    if (newListing.description_md.length < 20) { setListingError('Description must be at least 20 characters.'); return; }
    if (newListing.price_amount <= 0) { setListingError('Please set a price.'); return; }
    try {
      await api.post('/listings', {
        ...newListing,
        languages: newListing.languages.split(',').map(s => s.trim()),
        price_amount: Number(newListing.price_amount),
        images: newListing.images ? newListing.images.split('\n').map(s => s.trim()).filter(Boolean) : [],
        map_links: newListing.map_links ? newListing.map_links.split('\n').map(s => s.trim()).filter(Boolean) : [],
      });
      setNewListingOpen(false);
      setListingError('');
      setNewListing({ title: '', summary: '', description_md: '', city: 'Beijing', price_amount: 500, price_unit: 'per_half_day', cover_image_url: '', languages: 'en,zh', images: '', map_links: '' });
      loadListings();
      setSaveMsg('Listing published! It will appear on the Guides page.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setListingError(detail.map((d: any) => d.msg).join('. '));
      } else {
        setListingError(detail || 'Failed to create listing. Please check all fields.');
      }
    }
  };

  const deleteListing = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    try {
      await api.delete('/listings/' + id);
      loadListings();
    } catch {}
  };

  const acceptRequest = async (requestId: string) => {
    try {
      await api.put('/service-requests/' + requestId + '/accept');
      loadRequests();
    } catch {}
  };

  const declineRequest = async (requestId: string) => {
    try {
      await api.put('/service-requests/' + requestId + '/decline');
      loadRequests();
    } catch {}
  };

  const markAsMet = async (requestId: string) => {
    try {
      await api.put('/service-requests/' + requestId + '/met');
      loadRequests();
      setSaveMsg('Marked as met! Tourist can now leave a review.');
    } catch (err: any) {
      setSaveMsg('Failed: ' + (err?.response?.data?.detail || 'Unknown error'));
    }
  };

  const openReviewDialog = (request: any) => {
    setReviewTarget(request);
    setReviewStars(5);
    setReviewText('');
    setReviewMsg('');
    setReviewDialogOpen(true);
  };

  const submitReview = async () => {
    setReviewMsg('');
    if (!reviewTarget) return;
    try {
      await api.post('/reviews', {
        service_request_id: reviewTarget.id,
        stars: reviewStars,
        text: reviewText || null,
      });
      setReviewDialogOpen(false);
      setReviewTarget(null);
      loadRequests();
      setSaveMsg('Review submitted! Thank you for your feedback.');
    } catch (err: any) {
      setReviewMsg('Failed: ' + (err?.response?.data?.detail || 'Unknown error'));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('glc_token');
    localStorage.removeItem('glc_user');
    navigate('/');
  };

  if (!user) return null;
  const up = (field: string, value: any) => setProfile((p: any) => ({ ...p, [field]: value }));

  const guideTabs = ['My Listings', 'Requests', 'Profile'];
  const touristTabs = ['My Requests', 'Profile'];
  const tabLabels = user.role === 'guide' ? guideTabs : touristTabs;

  const formatHour = (h: number | null | undefined) => {
    if (h === null || h === undefined) return '';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:00 ${ampm}`;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Paper sx={{ p: 4, mb: 4, borderRadius: 3, background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Avatar sx={{ width: 80, height: 80, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 32, fontWeight: 700 }}>
            {(profile.display_name || user.email || 'U').charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{profile.display_name || user.email}</Typography>
            <Chip label={user.role === 'guide' ? 'Local Guide' : 'Tourist'}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mt: 1, fontWeight: 600 }} />
          </Box>
          <Button startIcon={<LogoutIcon />} onClick={handleLogout}
            sx={{ color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>Log Out</Button>
        </Box>
      </Paper>

      {saveMsg && <Alert severity={saveMsg.includes('Failed') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setSaveMsg('')}>{saveMsg}</Alert>}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, '& .Mui-selected': { color: '#DC2626' }, '& .MuiTabs-indicator': { bgcolor: '#DC2626' } }}>
        {tabLabels.map((label, i) => <Tab key={i} label={label} />)}
      </Tabs>

      {/* GUIDE TAB 0: Listings */}
      {user.role === 'guide' && tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Your Service Listings</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewListingOpen(true)}
              sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}>Create New Listing</Button>
          </Box>
          {listings.length === 0 ? (
            <Alert severity="info">No listings yet. Create your first one to start connecting with travelers!</Alert>
          ) : (
            listings.map((l) => (
              <Paper key={l.id} sx={{ p: 3, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{l.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{l.city} · ¥{l.price_amount} {l.price_unit}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                      <Chip label={l.status} size="small" color={l.status === 'published' ? 'success' : 'default'} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">{l.views || 0}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <FavoriteIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">{l.likes || 0}</Typography>
                      </Box>
                      {l.created_at && (
                        <Typography variant="caption" color="text.secondary">
                          Posted {new Date(l.created_at).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <IconButton color="error" onClick={() => deleteListing(l.id)}><DeleteIcon /></IconButton>
                </Box>
              </Paper>
            ))
          )}
        </Box>
      )}

      {/* GUIDE TAB 1: Requests */}
      {user.role === 'guide' && tab === 1 && (
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Connection Requests from Tourists</Typography>
          {requests.length === 0 ? (
            <Alert severity="info">No requests yet. Once tourists find your listings, their requests appear here.</Alert>
          ) : (
            requests.map((r: any) => (
              <Paper key={r.id} sx={{ p: 3, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {r.service_date}{r.service_time_hour !== null && r.service_time_hour !== undefined ? ` at ${formatHour(r.service_time_hour)}` : ''} · {r.party_size} {r.party_size > 1 ? 'people' : 'person'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">¥{r.quoted_amount} · {r.language}</Typography>
                    {r.tourist_notes && <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>"{r.tourist_notes}"</Typography>}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label={r.status} color={r.status === 'accepted' ? 'success' : r.status === 'met' ? 'info' : r.status === 'pending' ? 'warning' : 'default'} />
                    {r.status === 'pending' && (
                      <>
                        <Button size="small" variant="contained" color="success" onClick={() => acceptRequest(r.id)}>Accept</Button>
                        <Button size="small" variant="outlined" color="error" onClick={() => declineRequest(r.id)}>Decline</Button>
                      </>
                    )}
                    {r.status === 'accepted' && (
                      <Button size="small" variant="contained" startIcon={<HandshakeIcon />}
                        onClick={() => markAsMet(r.id)}
                        sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}>
                        We have met
                      </Button>
                    )}
                  </Box>
                </Box>
              </Paper>
            ))
          )}
        </Box>
      )}

      {/* TOURIST TAB 0: My Requests */}
      {user.role === 'tourist' && tab === 0 && (
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Your Connection Requests</Typography>
          {requests.length === 0 ? (
            <Alert severity="info" action={<Button color="inherit" size="small" onClick={() => navigate('/guides')}>Browse Guides</Button>}>
              No requests yet. Find a guide and start planning!
            </Alert>
          ) : (
            requests.map((r: any) => (
              <Paper key={r.id} sx={{ p: 3, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {r.service_date}{r.service_time_hour !== null && r.service_time_hour !== undefined ? ` at ${formatHour(r.service_time_hour)}` : ''} · {r.party_size} {r.party_size > 1 ? 'people' : 'person'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">¥{r.quoted_amount} {r.quoted_currency} · Language: {r.language}</Typography>
                    {r.tourist_notes && <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>"{r.tourist_notes}"</Typography>}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label={r.status} color={r.status === 'accepted' ? 'success' : r.status === 'met' ? 'info' : r.status === 'pending' ? 'warning' : 'default'} />
                    {r.status === 'met' && !r.has_review && (
                      <Button size="small" variant="contained" startIcon={<RateReviewIcon />}
                        onClick={() => openReviewDialog(r)}
                        sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}>
                        Write Review
                      </Button>
                    )}
                    {r.has_review && (
                      <Chip label="Reviewed" size="small" color="success" />
                    )}
                  </Box>
                </Box>
              </Paper>
            ))
          )}
        </Box>
      )}

      {/* PROFILE TAB (both roles) */}
      {((user.role === 'guide' && tab === 2) || (user.role === 'tourist' && tab === 1)) && (
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>Edit Profile</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Display Name" value={profile.display_name || ''} onChange={(e) => up('display_name', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Email" value={profile.email || ''} disabled />
            </Grid>
            {user.role === 'tourist' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Country Code (e.g. US, GB)" value={profile.nationality || ''}
                    onChange={(e) => up('nationality', e.target.value.toUpperCase())} inputProps={{ maxLength: 2 }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Preferred Currency</InputLabel>
                    <Select value={profile.preferred_currency || 'USD'} label="Preferred Currency"
                      onChange={(e) => up('preferred_currency', e.target.value)}>
                      {[['USD','$ US Dollar'],['EUR','€ Euro'],['GBP','£ British Pound'],['AUD','A$ Australian Dollar'],['JPY','¥ Japanese Yen'],['KRW','₩ Korean Won'],['CAD','C$ Canadian Dollar'],['CNY','¥ Chinese Yuan']].map(([code, label]) => (
                        <MenuItem key={code} value={code}>{label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            {user.role === 'guide' && (
              <>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={4} label="Bio" value={profile.bio || ''} onChange={(e) => up('bio', e.target.value)}
                    placeholder="What makes you unique? What will travelers experience with you?" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Languages (comma separated)" placeholder="en, zh, fr"
                    value={Array.isArray(profile.languages) ? profile.languages.join(', ') : profile.languages || ''}
                    onChange={(e) => up('languages', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Cities (comma separated)" placeholder="Beijing, Shanghai"
                    value={Array.isArray(profile.service_cities) ? profile.service_cities.join(', ') : profile.service_cities || ''}
                    onChange={(e) => up('service_cities', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Default Rate (CNY)" type="number" value={profile.default_rate_cny || ''}
                    onChange={(e) => up('default_rate_cny', Number(e.target.value))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Payment Note" placeholder="I accept Alipay, WeChat Pay, or cash"
                    value={profile.payment_note || ''} onChange={(e) => up('payment_note', e.target.value)} />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <Button variant="contained" onClick={saveProfile}
                sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}>Save Changes</Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* New Listing Dialog */}
      <Dialog open={newListingOpen} onClose={() => setNewListingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Listing</DialogTitle>
        <DialogContent sx={{ maxHeight: "70vh" }}>
          {listingError && <Alert severity="error" sx={{ mb: 2 }}>{listingError}</Alert>}
          <TextField fullWidth label="Title (min 5 chars)" placeholder="e.g. Beijing Hutong Deep Dive — Half Day" sx={{ mt: 1, mb: 2 }}
            value={newListing.title} onChange={(e) => setNewListing(p => ({ ...p, title: e.target.value }))} />
          <TextField fullWidth label="Summary — short pitch (min 10 chars)" placeholder="What will the traveler experience?" helperText="A quick hook that makes travelers want to read more" sx={{ mb: 2 }}
            value={newListing.summary} onChange={(e) => setNewListing(p => ({ ...p, summary: e.target.value }))} multiline rows={2} />
          <TextField fullWidth label="Full Description (min 20 chars)" placeholder="Tell the full story — paint a picture, share the details, make them feel it." helperText="The more detail you add, the more travelers will trust your trip" sx={{ mb: 2 }}
            value={newListing.description_md} onChange={(e) => setNewListing(p => ({ ...p, description_md: e.target.value }))} multiline rows={4} />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>City</InputLabel>
                <Select value={newListing.city} label="City" onChange={(e) => setNewListing(p => ({ ...p, city: e.target.value }))}>
                  {CITIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Price (CNY)" type="number" value={newListing.price_amount}
                onChange={(e) => setNewListing(p => ({ ...p, price_amount: Number(e.target.value) }))} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Duration</InputLabel>
                <Select value={newListing.price_unit} label="Duration" onChange={(e) => setNewListing(p => ({ ...p, price_unit: e.target.value }))}>
                  <MenuItem value="per_hour">Per Hour</MenuItem>
                  <MenuItem value="per_half_day">Per Half Day</MenuItem>
                  <MenuItem value="per_day">Per Full Day</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Languages" placeholder="en, zh" value={newListing.languages}
                onChange={(e) => setNewListing(p => ({ ...p, languages: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Cover Image URL (optional)" placeholder="https://..." value={newListing.cover_image_url}
                onChange={(e) => setNewListing(p => ({ ...p, cover_image_url: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Additional Image URLs (one per line)" placeholder={"https://image1.jpg\nhttps://image2.jpg"}
                value={newListing.images} onChange={(e) => setNewListing(p => ({ ...p, images: e.target.value }))}
                multiline rows={3} helperText="Add photos of the trip locations, food, scenery" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Map Links (one per line)" placeholder={"https://maps.google.com/...\nhttps://maps.baidu.com/..."}
                value={newListing.map_links} onChange={(e) => setNewListing(p => ({ ...p, map_links: e.target.value }))}
                multiline rows={2} helperText="Google Maps, Baidu Maps, or Amap links to meeting points or key locations" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewListingOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createListing}
            sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}>Publish Listing</Button>
        </DialogActions>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Write a Review</DialogTitle>
        <DialogContent>
          {reviewMsg && <Alert severity={reviewMsg.includes('Failed') ? 'error' : 'success'} sx={{ mb: 2 }}>{reviewMsg}</Alert>}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            How was your experience with this guide?
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Typography>Rating:</Typography>
            <Rating value={reviewStars} onChange={(_, v) => setReviewStars(v || 5)} size="large" />
          </Box>
          <TextField fullWidth multiline rows={4} label="Your Review (optional)"
            placeholder="Share your experience to help other travelers..."
            value={reviewText} onChange={(e) => setReviewText(e.target.value)}
            inputProps={{ maxLength: 2000 }}
            helperText={`${reviewText.length}/2000 characters`} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitReview}
            sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}>Submit Review</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
