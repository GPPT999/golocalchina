import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container, Typography, Box, Grid, Chip, Rating, Paper, Button,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Divider,
  LinearProgress, ImageList, ImageListItem
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import MapIcon from '@mui/icons-material/Map';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import AdBanner from '../components/AdBanner';
import api from '../services/api';

const initialRequestForm = {
  service_date: '',
  service_time_hour: '',
  party_size: '1',
  tourist_notes: '',
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function GuideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<string | null>(null);
  const [guide, setGuide] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [requestForm, setRequestForm] = useState(initialRequestForm);

  useEffect(() => {
    const loadGuide = async () => {
      try {
        const res = await api.get(`/guides/${id}`);
        setGuide(res.data);
      } catch (err) {
        console.error('Failed to load guide:', err);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadGuide();
  }, [id]);

  useEffect(() => {
    const loadReviews = async () => {
      if (!guide?.user_id) return;
      try {
        const res = await api.get(`/reviews/guide/${guide.user_id}?limit=10`);
        setReviews(res.data.reviews || []);
        setReviewStats(res.data.stats || null);
      } catch (err) {
        console.error('Failed to load reviews:', err);
      }
    };
    loadReviews();
  }, [guide?.user_id]);

  const handleConnect = (listingId: string) => {
    setSelectedListing(listingId);
    setConnectOpen(true);
    setSent(false);
    setRequestForm(initialRequestForm);
  };

  if (loading) return <Container sx={{ py: 8, textAlign: 'center' }}><Typography>Loading...</Typography></Container>;
  if (!guide) return (
    <Container sx={{ py: 8, textAlign: 'center' }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Guide not found.</Typography>
      <Button variant="contained" href="/guides" sx={{ bgcolor: '#DC2626' }}>Browse Guides</Button>
    </Container>
  );

  const displayName = guide.display_name || 'Guide';
  const languages = asStringArray(guide.languages);
  const specialties = asStringArray(guide.specialties);
  const listings = Array.isArray(guide.listings) ? guide.listings : [];
  const ratingAvg = asNumber(guide.rating_avg);
  const ratingCount = asNumber(guide.rating_count);

  const handleRequestFormChange = (field: keyof typeof initialRequestForm, value: string) => {
    setRequestForm((current) => ({ ...current, [field]: value }));
  };

  const sendRequest = async () => {
    const stored = localStorage.getItem('glc_user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const listing = listings.find((item: any) => item.id === selectedListing);
    setSending(true);
    try {
      await api.post('/service-requests', {
        guide_user_id: guide.user_id,
        listing_id: selectedListing,
        service_date: requestForm.service_date || new Date().toISOString().split('T')[0],
        service_time_hour: requestForm.service_time_hour ? parseInt(requestForm.service_time_hour, 10) : null,
        party_size: parseInt(requestForm.party_size || '1', 10),
        language: 'en',
        tourist_notes: requestForm.tourist_notes,
        quoted_amount: listing?.price_amount || guide.default_rate_cny || 0,
        quoted_currency: 'CNY',
      });
      setSent(true);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to send request. Make sure you are logged in.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={4}>
        {/* Left: Guide info */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Box sx={{
              width: 150, height: 150, borderRadius: '50%', bgcolor: '#1a472a', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 48, mx: 'auto', mb: 2
            }}>
              {displayName.charAt(0)}
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 700 }}>{displayName}</Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
              <VerifiedIcon color="success" sx={{ mr: 0.5 }} />
              <Typography variant="body2" color="success.main">{t('guide.verified')}</Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
              <Rating value={ratingAvg} precision={0.1} readOnly />
              <Typography variant="body2" sx={{ ml: 1 }}>
                {ratingAvg.toFixed(1)} ({ratingCount})
              </Typography>
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              License: {guide.guide_license_no}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Issued by: {guide.guide_license_issuer}
            </Typography>

            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
              {languages.map((l) => (
                <Chip key={l} label={l.toUpperCase()} size="small" />
              ))}
              {specialties.map((s) => (
                <Chip key={s} label={s} size="small" color="primary" variant="outlined" />
              ))}
            </Box>
          </Paper>

          <Paper sx={{ p: 3, mt: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, display: 'flex', alignItems: 'center' }}>
              <PaymentsIcon sx={{ mr: 1 }} /> {t('guide.payment_methods')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {guide.alipay_qr_url && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <QrCodeIcon color="primary" />
                  <Typography variant="body2">{t('payment.alipay')}</Typography>
                </Box>
              )}
              {guide.wechat_pay_qr_url && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <QrCodeIcon color="success" />
                  <Typography variant="body2">{t('payment.wechat')}</Typography>
                </Box>
              )}
              {guide.accepts_cash && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountBalanceWalletIcon color="action" />
                  <Typography variant="body2">{t('payment.cash')}</Typography>
                </Box>
              )}
            </Box>

            {guide.payment_note && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontStyle: 'italic' }}>
                "{guide.payment_note}"
              </Typography>
            )}

            <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem' }}>
              {t('payment.note')}
            </Alert>
          </Paper>

          <AdBanner slot="sidebar" />
        </Grid>

        {/* Right: Bio + Listings + Reviews */}
        <Grid item xs={12} md={8}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{t('guide.about')}</Typography>
          <Typography variant="body1" sx={{ mb: 4, lineHeight: 1.8 }}>{guide.bio}</Typography>

          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>{t('guide.listings')}</Typography>

          {listings.map((listing: any, idx: number) => (
            <Box key={listing.id}>
              <Paper sx={{ p: 3, mb: 2, '&:hover': { boxShadow: 4 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>{listing.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {listing.summary}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', ml: 2, minWidth: 120 }}>
                    <Typography variant="h5" color="primary" sx={{ fontWeight: 700 }}>
                      ¥{listing.price_amount}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('search.price_set_by_guide')}
                      <br />
                      {t(`search.${listing.price_unit}`)}
                    </Typography>
                  </Box>
                </Box>

                {/* Images Gallery */}
                {asStringArray(listing.images).length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Photos</Typography>
                    <ImageList sx={{ width: '100%', maxHeight: 200 }} cols={3} rowHeight={100}>
                      {asStringArray(listing.images).map((img: string, i: number) => (
                        <ImageListItem key={i}>
                          <img src={img} alt={`${listing.title} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
                        </ImageListItem>
                      ))}
                    </ImageList>
                  </Box>
                )}

                {/* Map Links */}
                {asStringArray(listing.map_links).length > 0 && (
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <MapIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    {asStringArray(listing.map_links).map((link: string, i: number) => (
                      <Button
                        key={i}
                        size="small"
                        variant="outlined"
                        endIcon={<OpenInNewIcon />}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ textTransform: 'none' }}
                      >
                        View on Map
                      </Button>
                    ))}
                  </Box>
                )}

                <Button
                  variant="contained"
                  sx={{ mt: 2, bgcolor: '#1a472a', '&:hover': { bgcolor: '#2d5a3f' } }}
                  onClick={() => handleConnect(listing.id)}
                >
                  {t('guide.connect')}
                </Button>
              </Paper>

              {idx === 1 && <AdBanner slot="in-feed" />}
            </Box>
          ))}

          {/* Reviews Section */}
          <Paper sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Reviews {reviewStats && `(${reviewStats.total_reviews})`}
            </Typography>

            {reviewStats && reviewStats.total_reviews > 0 && (
              <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ textAlign: 'center', mr: 3 }}>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: '#1a472a' }}>
                      {reviewStats.average_rating.toFixed(1)}
                    </Typography>
                    <Rating value={reviewStats.average_rating} precision={0.1} readOnly />
                    <Typography variant="caption" color="text.secondary">
                      {reviewStats.total_reviews} reviews
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviewStats.distribution?.[String(star)] || 0;
                      const percentage = reviewStats.total_reviews > 0 
                        ? (count / reviewStats.total_reviews) * 100 
                        : 0;
                      return (
                        <Box key={star} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ width: 20, color: 'text.secondary' }}>
                            {star}★
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={percentage} 
                            sx={{ flex: 1, mx: 1, height: 8, borderRadius: 1 }}
                          />
                          <Typography variant="caption" sx={{ width: 30, color: 'text.secondary' }}>
                            {count}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            )}

            {reviews.length === 0 ? (
              <Alert severity="info">No reviews yet. Be the first to review this guide!</Alert>
            ) : (
              <Box>
                {reviews.map((review: any) => (
                  <Box key={review.id} sx={{ mb: 3, pb: 3, borderBottom: '1px solid #e0e0e0', '&:last-child': { borderBottom: 'none' } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {review.reviewer_name || 'Anonymous'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Rating value={review.stars} size="small" readOnly />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(review.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    
                    {review.text && (
                      <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.6 }}>
                        {review.text}
                      </Typography>
                    )}

                    {review.guide_reply && (
                      <Box sx={{ mt: 2, ml: 3, p: 2, bgcolor: '#f9f9f9', borderRadius: 1, borderLeft: '3px solid #1a472a' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#1a472a' }}>
                          Guide Reply ({new Date(review.guide_replied_at).toLocaleDateString()})
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {review.guide_reply}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Connection Request Dialog */}
      <Dialog open={connectOpen} onClose={() => setConnectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('guide.connect')}</DialogTitle>
        <DialogContent>
          {sent ? (
            <Alert severity="success" sx={{ my: 2 }}>
              Request sent! Check your dashboard for updates. The guide will respond soon.
            </Alert>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('guide.connect_note')}
              </Alert>
              <Alert severity="success" sx={{ mb: 2 }} icon={<PaymentsIcon />}>
                {t('payment.direct_desc')}
              </Alert>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={requestForm.service_date}
                onChange={(event) => handleRequestFormChange('service_date', event.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2, mt: 1 }}
              />
              <TextField
                fullWidth
                label="Time (hour, 0-23)"
                type="number"
                value={requestForm.service_time_hour}
                onChange={(event) => handleRequestFormChange('service_time_hour', event.target.value)}
                inputProps={{ min: 0, max: 23 }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Group size"
                type="number"
                value={requestForm.party_size}
                onChange={(event) => handleRequestFormChange('party_size', event.target.value)}
                inputProps={{ min: 1, max: 30 }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Notes for the guide (optional)"
                value={requestForm.tourist_notes}
                onChange={(event) => handleRequestFormChange('tourist_notes', event.target.value)}
                multiline
                rows={3}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          {sent ? (
            <Button onClick={() => setConnectOpen(false)}>Close</Button>
          ) : (
            <>
              <Button onClick={() => setConnectOpen(false)}>Cancel</Button>
              <Button variant="contained" disabled={sending} sx={{ bgcolor: '#1a472a' }} onClick={sendRequest}>
                {sending ? 'Sending...' : 'Send Request'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
