import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Grid, Paper, Chip, Rating, Button,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import PlaceIcon from '@mui/icons-material/Place';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import VisibilityIcon from '@mui/icons-material/Visibility';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import AdBanner from '../components/AdBanner';

const DEFAULT_COVER = '/images/Beijing.jpg';

const initialRequestForm = {
  service_date: '',
  party_size: '1',
  tourist_notes: '',
};

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [requestForm, setRequestForm] = useState(initialRequestForm);

  useEffect(() => {
    if (id) {
      const likedListings = JSON.parse(localStorage.getItem('glc_liked_listings') || '{}');
      setLiked(!!likedListings[id]);
    }
  }, [id]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/explore/listings/' + id);
        if (res.data && !res.data.error) {
          setListing(res.data);
          setLikeCount(res.data.likes || 0);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [id]);

  const sendRequest = async () => {
    const stored = localStorage.getItem('glc_user');
    if (!stored) { navigate('/login'); return; }

    setSending(true);
    try {
      await api.post('/service-requests', {
        guide_user_id: listing.guide.user_id,
        listing_id: listing.id,
        service_date: requestForm.service_date || new Date().toISOString().split('T')[0],
        party_size: parseInt(requestForm.party_size || '1', 10),
        language: 'en',
        tourist_notes: requestForm.tourist_notes,
        quoted_amount: listing.price_amount,
        quoted_currency: listing.price_currency,
      });
      setSent(true);
    } catch {
      alert('Failed to send request. Make sure you are logged in.');
    } finally {
      setSending(false);
    }
  };

  const openConnectDialog = () => {
    setSent(false);
    setRequestForm(initialRequestForm);
    setConnectOpen(true);
  };

  const updateRequestForm = (field: keyof typeof initialRequestForm, value: string) => {
    setRequestForm((current) => ({ ...current, [field]: value }));
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stored = localStorage.getItem('glc_user');
    if (!stored) { navigate('/login'); return; }
    const likedListings = JSON.parse(localStorage.getItem('glc_liked_listings') || '{}');
    
    try {
      if (liked) {
        await api.post(`/listings/${id}/unlike`);
        delete likedListings[id!];
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await api.post(`/listings/${id}/like`);
        likedListings[id!] = true;
        setLikeCount(prev => prev + 1);
      }
      localStorage.setItem('glc_liked_listings', JSON.stringify(likedListings));
      setLiked(!liked);
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  if (loading) return <Container sx={{ py: 8, textAlign: 'center' }}><Typography>Loading...</Typography></Container>;
  if (!listing) return (
    <Container sx={{ py: 8, textAlign: 'center' }}>
      <Typography variant="h5" sx={{ mb: 2 }}>This listing is no longer available.</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The guide may have removed it, or it may have expired. Browse other guides below.
      </Typography>
      <Button variant="contained" href="/guides" sx={{ bgcolor: '#DC2626' }}>Browse All Guides</Button>
    </Container>
  );

  const guide = listing.guide || {};

  return (
    <Box>
      {/* Hero cover image */}
      <Box sx={{
        height: { xs: 300, md: 450 }, position: 'relative',
        backgroundImage: 'url(' + (listing.cover_image_url || DEFAULT_COVER) + ')',
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%)' }} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pb: 4 }}>
          <Chip icon={<PlaceIcon />} label={listing.city} sx={{ bgcolor: 'rgba(255,255,255,0.9)', mb: 1, width: 'fit-content' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h3" sx={{ color: 'white', fontWeight: 800, textShadow: '2px 2px 8px rgba(0,0,0,0.5)', fontSize: { xs: '1.8rem', md: '2.5rem' } }}>
              {listing.title}
            </Typography>
            <IconButton onClick={handleLike} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}>
              {liked ? <FavoriteIcon sx={{ color: '#DC2626' }} /> : <FavoriteBorderIcon />}
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,0.9)' }}>
              <VisibilityIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2">{listing.views || 0}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,0.9)' }}>
              <FavoriteIcon sx={{ fontSize: 18, color: liked ? '#DC2626' : 'rgba(255,255,255,0.9)' }} />
              <Typography variant="body2">{likeCount}</Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={4}>
          {/* Left: listing details */}
          <Grid item xs={12} md={8}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>About This Experience</Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.8, whiteSpace: 'pre-line', mb: 4 }}>
              {listing.summary}
            </Typography>

            <Paper variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Full Details</Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8, whiteSpace: 'pre-line', color: 'text.secondary' }}>
                {listing.description_md || listing.summary}
              </Typography>
            </Paper>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {(listing.languages || []).map((l: string) => (
                <Chip key={l} label={'Language: ' + l.toUpperCase()} variant="outlined" />
              ))}
              <Chip label={listing.price_unit === 'per_day' ? 'Full Day' : listing.price_unit === 'per_hour' ? 'Hourly' : 'Half Day'} variant="outlined" />
            </Box>

            <AdBanner slot="in-feed" />
          </Grid>

          {/* Right: guide info + booking */}
          <Grid item xs={12} md={4}>
            {/* Price card */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '2px solid #DC2626' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#DC2626', mb: 0.5 }}>
                ¥{listing.price_amount}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('search.price_set_by_guide')} · {listing.price_unit === 'per_day' ? 'per day' : listing.price_unit === 'per_hour' ? 'per hour' : 'per half day'}
              </Typography>
              <Button
                fullWidth variant="contained" size="large"
                onClick={openConnectDialog}
                sx={{ bgcolor: '#DC2626', py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: '#B91C1C' } }}
              >
                {t('guide.connect')}
              </Button>
            </Paper>

            {/* Guide card */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '50%', bgcolor: '#DC2626', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20,
                }}>
                  {(guide.display_name || '?').charAt(0)}
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{guide.display_name}</Typography>
                  {guide.is_certified && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <VerifiedIcon sx={{ fontSize: 16, color: '#DC2626' }} />
                      <Typography variant="caption" sx={{ color: '#DC2626' }}>Certified Guide</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Rating value={guide.rating_avg || 0} precision={0.1} size="small" readOnly />
                <Typography variant="body2" sx={{ ml: 1 }}>({guide.rating_count || 0} reviews)</Typography>
              </Box>
              {guide.bio && (
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {guide.bio}
                </Typography>
              )}
            </Paper>

            {/* Payment info */}
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, display: 'flex', alignItems: 'center' }}>
                <PaymentsIcon sx={{ mr: 1 }} /> Payment
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AccountBalanceWalletIcon color="action" />
                <Typography variant="body2">Pay your guide directly when you meet</Typography>
              </Box>
              {guide.payment_note && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
                  "{guide.payment_note}"
                </Typography>
              )}
              <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem' }}>
                {t('payment.note')}
              </Alert>
            </Paper>

            <AdBanner slot="sidebar" />
          </Grid>
        </Grid>
      </Container>

      {/* Connection request dialog */}
      <Dialog open={connectOpen} onClose={() => setConnectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('guide.connect')}</DialogTitle>
        <DialogContent>
          {sent ? (
            <Alert severity="success" sx={{ my: 2 }}>
              Request sent! Check your dashboard for updates. The guide will respond soon.
            </Alert>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>{t('guide.connect_note')}</Alert>
              <Alert severity="success" sx={{ mb: 2 }} icon={<PaymentsIcon />}>{t('payment.direct_desc')}</Alert>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={requestForm.service_date}
                onChange={(event) => updateRequestForm('service_date', event.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2, mt: 1 }}
              />
              <TextField
                fullWidth
                label="Group size"
                type="number"
                value={requestForm.party_size}
                onChange={(event) => updateRequestForm('party_size', event.target.value)}
                inputProps={{ min: 1, max: 30 }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Message to the guide (optional)"
                value={requestForm.tourist_notes}
                onChange={(event) => updateRequestForm('tourist_notes', event.target.value)}
                multiline
                rows={3}
                placeholder="Tell them what you're interested in, any special requests..."
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          {sent ? (
            <>
              <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
              <Button onClick={() => { setConnectOpen(false); setSent(false); }}>Close</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setConnectOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={sendRequest} disabled={sending}
                sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}>
                {sending ? 'Sending...' : 'Send Request'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
