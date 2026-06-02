import { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Paper, Button, Grid, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Chip,
  Card, CardContent, CardMedia, CardActions, IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function PostsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', images: '' });
  const [postError, setPostError] = useState('');
  const [msg, setMsg] = useState('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem('glc_user');
    if (!stored) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(stored));
    loadPosts();
    loadLikedPosts();
  }, [navigate]);

  const loadPosts = async () => {
    try {
      const res = await api.get('/posts?per_page=50');
      setPosts(res.data.posts || []);
    } catch (err) {
      console.error('Failed to load posts:', err);
    }
  };

  const loadLikedPosts = async () => {
    try {
      const res = await api.get('/posts/liked');
      setLikedPosts(new Set(res.data.liked_post_ids || []));
    } catch (err) {
      console.error('Failed to load liked posts:', err);
    }
  };

  const toggleLike = async (postId: string) => {
    try {
      if (likedPosts.has(postId)) {
        await api.post(`/posts/${postId}/like`);
        setLikedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        setPosts(prev => prev.map(p => 
          p.id === postId ? { ...p, like_count: Math.max(0, (p.like_count || 0) - 1) } : p
        ));
      } else {
        await api.post(`/posts/${postId}/like`);
        setLikedPosts(prev => new Set(prev).add(postId));
        setPosts(prev => prev.map(p => 
          p.id === postId ? { ...p, like_count: (p.like_count || 0) + 1 } : p
        ));
      }
    } catch (err: any) {
      alert('Failed: ' + (err?.response?.data?.detail || 'Unknown error'));
    }
  };

  const createPost = async () => {
    setPostError('');
    if (newPost.title.length < 5) {
      setPostError('Title must be at least 5 characters.');
      return;
    }
    if (newPost.content.length < 10) {
      setPostError('Content must be at least 10 characters.');
      return;
    }
    try {
      await api.post('/posts', {
        title: newPost.title,
        content: newPost.content,
        images: newPost.images.split(',').map(s => s.trim()).filter(s => s),
      });
      setNewPostOpen(false);
      setNewPost({ title: '', content: '', images: '' });
      loadPosts();
      setMsg('Post created!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      setPostError(err?.response?.data?.detail || 'Failed to create post.');
    }
  };

  const markAsDone = async (postId: string) => {
    try {
      await api.put(`/posts/${postId}/done`);
      loadPosts();
      setMsg('Post marked as done!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      alert('Failed: ' + (err?.response?.data?.detail || 'Unknown error'));
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      loadPosts();
      setMsg('Post deleted!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      alert('Failed: ' + (err?.response?.data?.detail || 'Unknown error'));
    }
  };

  if (!user) return null;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Community Posts</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Share your travel experiences, questions, and tips with other travelers.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setNewPostOpen(true)}
          sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}
        >
          Create Post
        </Button>
      </Box>

      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}

      {posts.length === 0 ? (
        <Alert severity="info">No posts yet. Be the first to share your story!</Alert>
      ) : (
        <Grid container spacing={3}>
          {posts.map((post) => (
            <Grid item xs={12} key={post.id}>
              <Card sx={{ '&:hover': { boxShadow: 4 } }}>
                {post.images && post.images.length > 0 && (
                  <CardMedia
                    component="img"
                    height="300"
                    image={post.images[0]}
                    alt={post.title}
                    sx={{ objectFit: 'cover' }}
                  />
                )}
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {post.title}
                    </Typography>
                    {post.is_done && (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Done"
                        size="small"
                        color="success"
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    By {post.author.display_name} · {timeAgo(post.created_at)}
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                    {post.content}
                  </Typography>
                  {post.images && post.images.length > 1 && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                      {post.images.slice(1).map((img: string, idx: number) => (
                        <Box
                          key={idx}
                          component="img"
                          src={img}
                          alt={`Image ${idx + 2}`}
                          sx={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 1 }}
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
                <CardActions sx={{ display: 'flex', justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton 
                      onClick={() => toggleLike(post.id)}
                      color={likedPosts.has(post.id) ? 'error' : 'default'}
                      size="small"
                    >
                      {likedPosts.has(post.id) ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                    </IconButton>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <FavoriteBorderIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {post.like_count || 0}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <VisibilityIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {post.view_count || 0}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {timeAgo(post.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                  {post.author.user_id === user.id && (
                    <Box>
                      {!post.is_done && (
                        <Button
                          size="small"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => markAsDone(post.id)}
                          color="success"
                        >
                          Done
                        </Button>
                      )}
                      <Button
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => deletePost(post.id)}
                        color="error"
                      >
                        Delete
                      </Button>
                    </Box>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Post Dialog */}
      <Dialog open={newPostOpen} onClose={() => setNewPostOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Post</DialogTitle>
        <DialogContent>
          {postError && <Alert severity="error" sx={{ mb: 2 }}>{postError}</Alert>}
          <TextField
            fullWidth
            label="Title (min 5 chars)"
            placeholder="e.g. Amazing experience in Beijing!"
            sx={{ mt: 1, mb: 2 }}
            value={newPost.title}
            onChange={(e) => setNewPost(p => ({ ...p, title: e.target.value }))}
          />
          <TextField
            fullWidth
            label="Content (min 10 chars)"
            placeholder="Share your story, tips, or questions..."
            multiline
            rows={6}
            sx={{ mb: 2 }}
            value={newPost.content}
            onChange={(e) => setNewPost(p => ({ ...p, content: e.target.value }))}
          />
          <TextField
            fullWidth
            label="Image URLs (comma separated, optional)"
            placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
            helperText="Add image URLs separated by commas"
            value={newPost.images}
            onChange={(e) => setNewPost(p => ({ ...p, images: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewPostOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={createPost}
            sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}
          >
            Publish Post
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
