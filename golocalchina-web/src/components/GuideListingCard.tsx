import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, Chip, Rating, IconButton } from '@mui/material';
import { Link } from 'react-router-dom';
import VerifiedIcon from '@mui/icons-material/Verified';
import PlaceIcon from '@mui/icons-material/Place';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const DEFAULT_COVER = '/images/Beijing.jpg';

// Currency conversion
const FX: Record<string, [string, number]> = {
  USD: ['$', 0.14], EUR: ['€', 0.13], GBP: ['£', 0.11], AUD: ['A$', 0.22],
  JPY: ['¥', 21.5], KRW: ['₩', 192], CAD: ['C$', 0.19], CNY: ['¥', 1],
};
function convertPrice(cny: number): string {
  try {
    const stored = localStorage.getItem('glc_user');
    if (!stored) return '¥' + cny;
    const { currency } = JSON.parse(stored);
    if (!currency || currency === 'CNY') return '¥' + cny;
    const [sym, rate] = FX[currency] || ['¥', 1];
    return sym + Math.round(cny * rate);
  } catch { return '¥' + cny; }
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

// Get liked listings from localStorage
function getLikedIds(): Set<string> {
  try {
    const stored = localStorage.getItem('glc_liked_listings');
    return new Set(stored ? JSON.parse(stored) : []);
  } catch { return new Set(); }
}

function setLikedIds(ids: Set<string>) {
  localStorage.setItem('glc_liked_listings', JSON.stringify([...ids]));
}

interface Props {
  listing: any;
}

export default function GuideListingCard({ listing }: Props) {
  const { t } = useTranslation();
  const guide = listing.guide || {};
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(listing.likes || 0);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    const likedIds = getLikedIds();
    setLiked(likedIds.has(listing.id));
    setLikeCount(listing.likes || 0);
  }, [listing.id, listing.likes]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (liking) return;

    const stored = localStorage.getItem('glc_user');
    if (!stored) return;

    setLiking(true);
    const likedIds = getLikedIds();
    const wasLiked = likedIds.has(listing.id);

    try {
      if (wasLiked) {
        // Unlike
        const res = await api.post(`/listings/${listing.id}/unlike`);
        setLikeCount(res.data.likes_count);
        likedIds.delete(listing.id);
        setLiked(false);
      } else {
        // Like
        const res = await api.post(`/listings/${listing.id}/like`);
        setLikeCount(res.data.likes_count);
        likedIds.add(listing.id);
        setLiked(true);
      }
      setLikedIds(likedIds);
    } catch (err) {
      console.error('Like/unlike failed:', err);
    } finally {
      setLiking(false);
    }
  };

  return (
    <Card
      component={Link}
      to={'/listing/' + listing.id}
      sx={{
        height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3,
        textDecoration: 'none', color: 'inherit', overflow: 'hidden',
        '&:hover': { boxShadow: 8, transform: 'translateY(-4px)' }, transition: 'all 0.2s',
      }}
    >
      {/* Cover image with overlay */}
      <Box sx={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <Box
          component="img"
          src={listing.cover_image_url || DEFAULT_COVER}
          alt={listing.title}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 50%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 2,
        }}>
          <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700, lineHeight: 1.3 }}>
            {listing.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <PlaceIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              {listing.city}
            </Typography>
          </Box>
        </Box>
        {/* Price badge */}
        <Box sx={{
          position: 'absolute', top: 12, right: 12,
          bgcolor: '#DC2626', color: 'white', px: 1.5, py: 0.5, borderRadius: 2,
          fontWeight: 700, fontSize: '0.9rem',
        }}>
          {convertPrice(listing.price_amount)}
        </Box>
        {/* Certified badge */}
        {guide.is_certified && (
          <Chip icon={<VerifiedIcon sx={{ fontSize: 14 }} />} label="Certified" size="small"
            sx={{ position: 'absolute', top: 12, left: 12, bgcolor: 'rgba(255,255,255,0.95)', fontWeight: 600, fontSize: '0.7rem' }} />
        )}
      </Box>

      <CardContent sx={{ flexGrow: 1, pt: 2 }}>
        {/* Guide info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: '50%', bgcolor: '#DC2626', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0,
          }}>
            {(guide.display_name || '?').charAt(0)}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{guide.display_name}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Rating value={guide.rating_avg || 0} precision={0.1} size="small" readOnly sx={{ fontSize: 14 }} />
              <Typography variant="caption" color="text.secondary">
                ({guide.rating_count || 0})
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Summary */}
        <Typography variant="body2" color="text.secondary" sx={{
          mb: 1.5, lineHeight: 1.6, display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {listing.summary}
        </Typography>

        {/* Languages */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          {(listing.languages || []).map((l: string) => (
            <Chip key={l} label={l.toUpperCase()} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 22 }} />
          ))}
        </Box>

        {/* Stats: views, likes (clickable), post time */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {listing.views || 0}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <IconButton
              onClick={handleLike}
              disabled={liking}
              size="small"
              sx={{ p: 0.3 }}
            >
              {liked ? (
                <FavoriteIcon sx={{ fontSize: 16, color: '#DC2626' }} />
              ) : (
                <FavoriteBorderIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              )}
            </IconButton>
            <Typography variant="caption" color="text.secondary">
              {likeCount}
            </Typography>
          </Box>
          {listing.created_at && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {formatRelativeTime(listing.created_at)}
              </Typography>
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" display="block">
          {t('search.price_set_by_guide')} · {listing.price_unit === 'per_day' ? t('search.per_day') : listing.price_unit === 'per_hour' ? t('search.per_hour') : t('search.per_half_day')}
        </Typography>
      </CardContent>
    </Card>
  );
}
