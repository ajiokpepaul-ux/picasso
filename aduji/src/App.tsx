import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Activity, Bell, Bookmark, Check, ChevronDown, Compass, Flame, Heart, Home,
  LogOut, Menu, MessageCircle, MoreHorizontal, Play, Plus, Radio, Search,
  Send, Settings, ShieldCheck, Sparkles, TrendingUp, Upload, UserRound, Video,
  Volume2, VolumeX, X, Zap
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

type Profile = { id: string; username: string; display_name: string; avatar_url?: string | null; bio?: string | null; };
type Clip = {
  id: string; user_id?: string; caption: string; video_url: string; thumbnail_url?: string | null;
  category?: string; likes_count?: number; comments_count?: number; views_count?: number;
  created_at?: string; profiles?: Profile | null;
};
type Tab = 'For You' | 'Following' | 'Live' | 'Explore';

const demoClips: Clip[] = [
  { id: 'demo-1', caption: 'The little moments make the biggest memories ✨ #dailyvibes', video_url: 'https://videos.pexels.com/video-files/854222/854222-hd_1920_1080_25fps.mp4', category: 'Lifestyle', likes_count: 28400, comments_count: 814, views_count: 201000, profiles: { id: 'creator-1', username: 'amara.creates', display_name: 'Amara ✨' } },
  { id: 'demo-2', caption: 'POV: you finally take that trip 🌍 Where should I go next?', video_url: 'https://videos.pexels.com/video-files/3129671/3129671-hd_1920_1080_25fps.mp4', category: 'Travel', likes_count: 18200, comments_count: 523, views_count: 132000, profiles: { id: 'creator-2', username: 'daylight.diary', display_name: 'Daylight Diary' } },
  { id: 'demo-3', caption: 'A few seconds of calm for your timeline 🌿', video_url: 'https://videos.pexels.com/video-files/854223/854223-hd_1920_1080_25fps.mp4', category: 'Nature', likes_count: 9600, comments_count: 209, views_count: 67000, profiles: { id: 'creator-3', username: 'slow.moments', display_name: 'Slow Moments' } },
];

const short = (n = 0) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n);
const avatarColors = ['#d7a6ff', '#8be9d3', '#ffbd83', '#ff8fa3', '#9db7ff'];

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clips, setClips] = useState<Clip[]>(demoClips);
  const [tab, setTab] = useState<Tab>('For You');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [liked, setLiked] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, { id: string; body: string; username: string }[]>>({});
  const [commentText, setCommentText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const observer = useRef<IntersectionObserver | null>(null);

  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(''), 3200); };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) { setProfile(null); return; }
    let live = true;
    const loadProfile = async () => {
      const user = session.user;
      const { data } = await supabase!.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!live) return;
      if (data) setProfile(data as Profile);
      else {
        const username = (user.email?.split('@')[0] || `creator_${user.id.slice(0, 6)}`).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 22);
        const candidate = { id: user.id, username: `${username}_${user.id.slice(0, 4)}`, display_name: user.user_metadata?.full_name || username };
        const { data: created } = await supabase!.from('profiles').upsert(candidate).select().single();
        if (live && created) setProfile(created as Profile);
      }
    };
    loadProfile();
    return () => { live = false; };
  }, [session]);

  const loadClips = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('videos')
      .select('id,user_id,caption,video_url,thumbnail_url,category,likes_count,comments_count,views_count,created_at,profiles(id,username,display_name,avatar_url,bio)')
      .eq('visibility', 'public').order('created_at', { ascending: false }).limit(50);
    if (!error && data && data.length) setClips(data as unknown as Clip[]);
  };
  useEffect(() => { loadClips(); }, []);

  const filteredClips = useMemo(() => {
    let items = [...clips];
    if (tab === 'Following') items = items.filter(c => c.user_id && followed.includes(c.user_id));
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(c => `${c.caption} ${c.category || ''} ${c.profiles?.username || ''} ${c.profiles?.display_name || ''}`.toLowerCase().includes(q));
    }
    // Transparent MVP ranking: recency, engagement, and a small exploration boost.
    // Replace with server-side ranking after collecting consented, privacy-safe signals.
    if (tab === 'For You') items.sort((a, b) => rank(b) - rank(a));
    return items;
  }, [clips, tab, search, followed, liked]);

  function rank(c: Clip) {
    const hours = Math.max(0, (Date.now() - new Date(c.created_at || Date.now()).getTime()) / 36e5);
    const fresh = Math.exp(-hours / 72);
    const engagement = Math.log1p((c.likes_count || 0) * 2 + (c.comments_count || 0) * 3);
    const ownInterest = liked.length ? (liked.includes(c.id) ? 0.25 : 0) : 0;
    return fresh * 2 + engagement * 0.12 + ownInterest + (c.category ? 0.05 : 0);
  }

  async function authenticate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setAuthError(''); setAuthBusy(true);
    if (!supabase) { setAuthError('Add your Supabase settings in .env first.'); setAuthBusy(false); return; }
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') || '');
    const password = String(fd.get('password') || '');
    const name = String(fd.get('name') || '');
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setAuthError(result.error.message);
    else {
      setAuthOpen(false);
      notify(authMode === 'signup' ? 'Account request sent. Check your email if confirmation is enabled.' : 'Welcome back to Aduji.');
    }
    setAuthBusy(false);
  }

  async function googleSignIn() {
    if (!supabase) { setAuthError('Supabase is not configured.'); return; }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) setAuthError(error.message);
  }

  async function signOut() { await supabase?.auth.signOut(); setProfile(null); notify('Signed out.'); }
  function needAuth(message = 'Sign in to use this feature.') { if (!session) { setAuthOpen(true); notify(message); return false; } return true; }

  async function toggleLike(clip: Clip) {
    if (!needAuth('Sign in to like videos.')) return;
    const wasLiked = liked.includes(clip.id);
    setLiked(old => wasLiked ? old.filter(id => id !== clip.id) : [...old, clip.id]);
    setClips(old => old.map(c => c.id === clip.id ? { ...c, likes_count: Math.max(0, (c.likes_count || 0) + (wasLiked ? -1 : 1)) } : c));
    if (supabase && !clip.id.startsWith('demo-')) {
      if (wasLiked) await supabase.from('likes').delete().eq('video_id', clip.id).eq('user_id', session!.user.id);
      else await supabase.from('likes').upsert({ video_id: clip.id, user_id: session!.user.id });
    }
  }

  async function toggleSave(clip: Clip) {
    if (!needAuth('Sign in to save videos.')) return;
    const wasSaved = saved.includes(clip.id);
    setSaved(old => wasSaved ? old.filter(id => id !== clip.id) : [...old, clip.id]);
    if (supabase && !clip.id.startsWith('demo-')) {
      if (wasSaved) await supabase.from('bookmarks').delete().eq('video_id', clip.id).eq('user_id', session!.user.id);
      else await supabase.from('bookmarks').upsert({ video_id: clip.id, user_id: session!.user.id });
    }
    notify(wasSaved ? 'Removed from saved.' : 'Saved to your collection.');
  }

  async function toggleFollow(clip: Clip) {
    if (!needAuth('Sign in to follow creators.')) return;
    if (!clip.user_id) { notify('Demo creator — follow is available on published videos.'); return; }
    const was = followed.includes(clip.user_id);
    setFollowed(old => was ? old.filter(id => id !== clip.user_id) : [...old, clip.user_id!]);
    if (supabase) {
      if (was) await supabase.from('follows').delete().eq('follower_id', session!.user.id).eq('following_id', clip.user_id);
      else await supabase.from('follows').upsert({ follower_id: session!.user.id, following_id: clip.user_id });
    }
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!needAuth('Sign in to join the conversation.') || !commentsFor || !commentText.trim()) return;
    const body = commentText.trim();
    const local = { id: crypto.randomUUID(), body, username: profile?.username || 'you' };
    setComments(old => ({ ...old, [commentsFor]: [...(old[commentsFor] || []), local] }));
    setCommentText('');
    const clip = clips.find(c => c.id === commentsFor);
    if (supabase && clip && !clip.id.startsWith('demo-')) {
      const { error } = await supabase.from('comments').insert({ video_id: clip.id, user_id: session!.user.id, body });
      if (error) notify('Comment could not be saved: ' + error.message);
    } else notify('Comment added locally to this demo video.');
  }

  async function uploadVideo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!needAuth('Sign in to publish videos.')) return;
    if (!supabase) { notify('Connect Supabase to publish.'); return; }
    setUploading(true);
    const fd = new FormData(e.currentTarget);
    const file = fd.get('video') as File;
    const caption = String(fd.get('caption') || '').trim();
    const category = String(fd.get('category') || 'Lifestyle');
    if (!file || !file.size) { notify('Choose a video file first.'); setUploading(false); return; }
    if (file.size > 100 * 1024 * 1024) { notify('Video must be 100 MB or smaller for this MVP.'); setUploading(false); return; }
    const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: storageError } = await supabase.storage.from('videos').upload(path, file, { contentType: file.type, upsert: false });
    if (storageError) { notify('Upload failed: ' + storageError.message); setUploading(false); return; }
    const { data: publicData } = supabase.storage.from('videos').getPublicUrl(path);
    const { error } = await supabase.from('videos').insert({
      user_id: session.user.id, caption, video_url: publicData.publicUrl, category, visibility: 'public'
    });
    if (error) notify('Video uploaded but post creation failed: ' + error.message);
    else { notify('Your video is live on Aduji.'); setUploadOpen(false); await loadClips(); }
    setUploading(false);
  }

  async function startLive(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!needAuth('Sign in to start a live stream.')) return;
    if (!supabase) { notify('Connect Supabase first.'); return; }
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') || 'Live on Aduji');
    const { error } = await supabase.from('live_streams').insert({
      user_id: session!.user.id, title, status: 'scheduled', provider: 'external', stream_url: null
    });
    if (error) notify('Could not create live session: ' + error.message);
    else { setLiveOpen(false); notify('Live session created. Connect a streaming provider to broadcast video.'); }
  }

  const navItems = [
    { name: 'For You' as Tab, icon: Home }, { name: 'Following' as Tab, icon: UserRound },
    { name: 'Live' as Tab, icon: Radio }, { name: 'Explore' as Tab, icon: Compass }
  ];

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-btn mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(v => !v)}><Menu size={20}/></button>
      <button className="brand" onClick={() => { setTab('For You'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
        <span className="brand-mark">a</span><span>aduji<span className="brand-dot">.</span></span>
      </button>
      <div className="search-box"><Search size={18}/><input aria-label="Search Aduji" placeholder="Search creators, sounds, videos..." value={search} onChange={e => setSearch(e.target.value)}/><kbd>⌘ K</kbd></div>
      <div className="top-actions">
        <button className="upload-btn" onClick={() => needAuth() && setUploadOpen(true)}><Plus size={17}/> <span>Upload</span></button>
        <button className="live-top" onClick={() => needAuth() && setLiveOpen(true)}><Radio size={16}/> <span>Go Live</span></button>
        <button className="icon-btn notification-btn" aria-label="Notifications" onClick={() => notify('You’re all caught up.') }><Bell size={19}/><i/></button>
        {session ? <button className="profile-chip" onClick={signOut} title="Click to sign out"><span className="avatar tiny">{(profile?.display_name || session.user.email || 'A').slice(0,1).toUpperCase()}</span><span className="profile-chip-name">{profile?.username || 'Your account'}</span><ChevronDown size={14}/></button> :
          <button className="sign-in-btn" onClick={() => { setAuthMode('signin'); setAuthOpen(true); }}>Sign in <span>↗</span></button>}
      </div>
    </header>

    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="side-section"><div className="side-label">DISCOVER</div>{navItems.map(item => <button key={item.name} className={`nav-item ${tab === item.name ? 'active' : ''}`} onClick={() => { setTab(item.name); setMobileNav(false); }}><item.icon size={19}/><span>{item.name}</span>{item.name === 'Live' && <span className="live-pip"/>}</button>)}</div>
      <div className="side-section trend-section"><div className="side-label">TRENDING NOW <Flame size={13}/></div>{['#AdujiChallenge', '#NaijaCreators', '#DayInMyLife', '#Afrobeats', '#LearnOnAduji'].map((tag, i) => <button key={tag} className="trend-item" onClick={() => { setSearch(tag.replace('#','')); setTab('Explore'); }}><span className="trend-hash">#</span><span>{tag.slice(1)}</span><small>{['2.4M','892K','621K','410K','208K'][i]}</small></button>)}</div>
      <div className="side-promo"><div className="promo-icon"><Sparkles size={17}/></div><strong>Your creativity, amplified.</strong><p>Find your people. Share your world. Build something real.</p><button onClick={() => needAuth() && setUploadOpen(true)}>Start creating <span>→</span></button></div>
      <div className="sidebar-footer"><button onClick={() => notify('Community guidelines are being prepared for launch.')}><ShieldCheck size={15}/> Community guidelines</button><span>© 2026 Aduji</span><span>Built for the next wave.</span></div>
    </aside>

    <main className="main-content">
      <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> THE NEXT WAVE OF SOCIAL</div><h1>Your world, <span>in motion.</span></h1><p>Discover the people, ideas, and moments worth your time.</p></div><div className="welcome-orb"><div className="orb-ring ring-one"/><div className="orb-ring ring-two"/><div className="orb-core"><Play fill="currentColor" size={22}/></div><span className="orb-star star-one">✳</span><span className="orb-star star-two">✦</span></div></div>
      <div className="feed-toolbar"><div className="feed-tabs">{(['For You','Following','Live','Explore'] as Tab[]).map(t => <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t === 'For You' && <Zap size={15}/ >}{t === 'Live' && <Radio size={15}/ >}{t}{t === 'For You' && <span className="tab-new">AI</span>}</button>)}</div><button className="sort-btn" onClick={() => notify('For You uses recency, engagement and exploration signals in this MVP.')}><Activity size={15}/> Smart mix <ChevronDown size={14}/></button></div>

      {tab === 'Live' ? <LivePanel onStart={() => needAuth() && setLiveOpen(true)} /> :
       tab === 'Explore' && !search ? <ExplorePanel onPick={q => setSearch(q)}/> :
       <div className="feed-layout"><section className="video-feed">
        {filteredClips.length ? filteredClips.map((clip, index) => <article className="video-card" key={clip.id}>
          <div className="creator-row"><div className="avatar" style={{ background: avatarColors[index % avatarColors.length] }}>{(clip.profiles?.display_name || 'A').slice(0,1).toUpperCase()}</div><div className="creator-meta"><strong>{clip.profiles?.display_name || 'Aduji Creator'} <span className="verified"><Check size={10}/></span></strong><span>@{clip.profiles?.username || 'creator'} · {clip.category || 'Video'}</span></div>{clip.user_id && clip.user_id !== session?.user.id && <button className={`follow-btn ${followed.includes(clip.user_id) ? 'following' : ''}`} onClick={() => toggleFollow(clip)}>{followed.includes(clip.user_id) ? 'Following' : 'Follow'} <Plus size={13}/></button>}<button className="more-btn" onClick={() => notify('More creator options coming soon.')} aria-label="More options"><MoreHorizontal size={20}/></button></div>
          <div className="video-frame" onClick={() => setActiveClip(activeClip === clip.id ? null : clip.id)}>
            <video src={clip.video_url} poster={clip.thumbnail_url || undefined} autoPlay={index === 0} muted={muted} loop playsInline controls={activeClip === clip.id} onError={() => {}}/>
            <div className="video-gradient"/><div className="video-top-tags"><span className="video-category">{clip.category || 'CREATOR SPOTLIGHT'}</span><span className="quality-pill"><span/> ADUJI ORIGINAL</span></div>
            <div className="video-caption"><span>{clip.caption}</span><div className="sound-label"><Volume2 size={13}/> Original sound · @{clip.profiles?.username || 'creator'}</div></div>
            <button className="sound-toggle" aria-label={muted ? 'Unmute videos' : 'Mute videos'} onClick={e => { e.stopPropagation(); setMuted(v => !v); }}>{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
            <div className="video-play"><Play size={22} fill="currentColor"/></div>
          </div>
          <div className="video-actions"><button className={liked.includes(clip.id) ? 'action-liked' : ''} onClick={() => toggleLike(clip)}><Heart size={20} fill={liked.includes(clip.id) ? 'currentColor' : 'none'}/><span>{short((clip.likes_count || 0) + (liked.includes(clip.id) && !(clip.likes_count) ? 1 : 0))}</span></button><button onClick={() => setCommentsFor(clip.id)}><MessageCircle size={20}/><span>{short(clip.comments_count || 0)}</span></button><button onClick={() => toggleSave(clip)} className={saved.includes(clip.id) ? 'action-saved' : ''}><Bookmark size={19} fill={saved.includes(clip.id) ? 'currentColor' : 'none'}/><span>{saved.includes(clip.id) ? 'Saved' : 'Save'}</span></button><button onClick={() => { navigator.clipboard?.writeText(window.location.href + '#video-' + clip.id); notify('Link copied if clipboard permission is available.'); }}><Send size={18}/><span>Share</span></button><div className="action-spacer"/><span className="view-count"><Play size={13} fill="currentColor"/> {short(clip.views_count || 0)} views</span></div>
        </article>) : <div className="empty-state"><div className="empty-icon"><Search size={23}/></div><h3>{tab === 'Following' ? 'Your circle starts here.' : 'Nothing found just yet.'}</h3><p>{tab === 'Following' ? 'Follow creators to shape a feed that feels like yours.' : 'Try another search or explore a new topic.'}</p><button className="primary-btn" onClick={() => { setTab('Explore'); setSearch(''); }}>Explore creators <Compass size={16}/></button></div>}
        <div className="end-feed"><span/><p>You're at the edge of your feed.</p><span/></div>
       </section><aside className="right-rail"><div className="rail-card creator-card"><div className="rail-heading"><span>CREATORS TO WATCH</span><button onClick={() => notify('Creator discovery refreshes as the community grows.')}>See all</button></div>{[{name:'Zara Creates',handle:'@zaracreates',color:'#f5a4bf',tag:'Lifestyle'},{name:'Tobi Visuals',handle:'@tobivisuals',color:'#b3a1ff',tag:'Film & art'},{name:'Kemi Cooks',handle:'@kemicooks',color:'#ffc48a',tag:'Food'}].map((c,i)=><div className="suggested-creator" key={c.handle}><div className="avatar" style={{background:c.color}}>{c.name[0]}</div><div className="suggested-info"><strong>{c.name}</strong><span>{c.handle} · {c.tag}</span></div><button onClick={() => needAuth() && notify('Creator suggestions will connect to real profiles after launch.')} aria-label={`Follow ${c.name}`}><Plus size={15}/></button></div>)}</div><div className="rail-card pulse-card"><div className="rail-heading"><span><TrendingUp size={14}/> WHAT'S MOVING</span><span className="pulse-live">LIVE</span></div>{[{tag:'#AdujiChallenge',n:'2.4M posts',up:'+18%'},{tag:'#NaijaCreators',n:'892K posts',up:'+12%'},{tag:'#LearnSomething',n:'621K posts',up:'+8%'}].map(t=><button className="pulse-row" key={t.tag} onClick={() => {setSearch(t.tag.slice(1));setTab('Explore')}}><span><strong>{t.tag}</strong><small>{t.n}</small></span><em>{t.up}</em></button>)}</div><div className="safety-note"><ShieldCheck size={18}/><div><strong>Community first.</strong><p>Block, report, and privacy controls belong at the heart of a healthy community.</p><button onClick={() => notify('Safety controls are part of the launch checklist.')}>Our safety promise →</button></div></div></aside></div>}
    </main>

    <footer className="mobile-bottom">{navItems.map(item => <button key={item.name} className={tab === item.name ? 'active' : ''} onClick={() => setTab(item.name)}><item.icon size={20}/><span>{item.name}</span></button>)}<button onClick={() => session ? signOut() : setAuthOpen(true)}><UserRound size={20}/><span>Account</span></button></footer>

    {authOpen && <Modal title={authMode === 'signin' ? 'Welcome back.' : 'Join the next wave.'} subtitle={authMode === 'signin' ? 'Your people and your next favorite video are waiting.' : 'Create your Aduji account and start finding your people.'} onClose={() => {setAuthOpen(false);setAuthError('')}}>
      <button className="google-btn" onClick={googleSignIn}><GoogleMark/> Continue with Google</button><div className="or-divider"><span/>or continue with email<span/></div>
      <form className="modal-form" onSubmit={authenticate}>{authMode === 'signup' && <label>Display name<input name="name" placeholder="What should we call you?" required/></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" required autoComplete="email"/></label><label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength={8} required autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}/></label>{authError && <p className="form-error">{authError}</p>}<button className="primary-btn full-btn" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signin' ? 'Sign in' : 'Create account'} <span>→</span></button></form>
      <p className="switch-auth">{authMode === 'signin' ? 'New to Aduji?' : 'Already have an account?'} <button onClick={() => {setAuthMode(authMode === 'signin' ? 'signup' : 'signin');setAuthError('')}}>{authMode === 'signin' ? 'Create an account' : 'Sign in'}</button></p><p className="modal-legal">By continuing, you agree to our Terms and Privacy Policy.</p>
    </Modal>}

    {uploadOpen && <Modal title="Make something move." subtitle="Share a moment, a skill, or a whole new perspective." onClose={() => setUploadOpen(false)}><form className="modal-form" onSubmit={uploadVideo}><label>Video file<input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" required/></label><label>Caption<textarea name="caption" placeholder="Give your video a little context…" rows={3} maxLength={2200}/></label><label>Category<select name="category"><option>Lifestyle</option><option>Comedy</option><option>Music</option><option>Education</option><option>Travel</option><option>Food</option><option>Gaming</option><option>Art</option><option>Sports</option></select></label><p className="upload-hint"><ShieldCheck size={15}/> Only post videos you have the right to share. Max 100 MB in this starter build.</p><button className="primary-btn full-btn" disabled={uploading}>{uploading ? 'Uploading…' : 'Publish video'} <Upload size={16}/></button></form></Modal>}

    {liveOpen && <Modal title="Go live on Aduji." subtitle="Set up your session. Live video broadcasting needs a streaming provider to be connected." onClose={() => setLiveOpen(false)}><form className="modal-form" onSubmit={startLive}><label>Stream title<input name="title" placeholder="What are we talking about?" required maxLength={120}/></label><div className="live-info-box"><Radio size={20}/><div><strong>Live session setup</strong><p>This saves a live session record. It does not start camera broadcasting yet. Connect a WebRTC streaming provider and secure stream-token endpoint for real live video.</p></div></div><button className="primary-btn full-btn">Create live session <Radio size={16}/></button></form></Modal>}

    {commentsFor && <Modal title="The conversation." subtitle="Good comments make good communities." onClose={() => setCommentsFor(null)}><div className="comments-list">{(comments[commentsFor] || []).length ? comments[commentsFor].map(c=><div className="comment" key={c.id}><div className="avatar tiny">{c.username[0]?.toUpperCase()}</div><div><strong>@{c.username}</strong><p>{c.body}</p></div></div>) : <div className="comments-empty"><MessageCircle size={25}/><strong>Be the first to say something.</strong><span>Keep it kind. Keep it real.</span></div>}</div><form className="comment-form" onSubmit={addComment}><input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a thoughtful comment…" maxLength={1000}/><button aria-label="Send comment"><Send size={17}/></button></form></Modal>}

    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}

function Modal({title, subtitle, onClose, children}: {title:string;subtitle:string;onClose:()=>void;children:React.ReactNode}) {
  return <div className="modal-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) onClose()}}><section className="modal"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={18}/></button><div className="modal-brand"><span className="brand-mark">a</span><span>aduji<span className="brand-dot">.</span></span></div><h2>{title}</h2><p className="modal-subtitle">{subtitle}</p>{children}</section></div>;
}
function GoogleMark() { return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.98 46.98 31.8 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>}
function LivePanel({onStart}:{onStart:()=>void}) {
  return <div className="live-page"><div className="live-hero"><div className="live-hero-copy"><span className="live-kicker"><span/> ADUJI LIVE</span><h2>Real time.<br/><span>Real connection.</span></h2><p>Meet creators as it happens. Join conversations, share what you know, and make the moment yours.</p><button className="primary-btn" onClick={onStart}>Set up a live <Radio size={16}/></button></div><div className="live-art"><div className="live-art-ring"/><div className="live-art-ring two"/><div className="live-art-center"><Radio size={35}/></div><div className="live-float float-a"><span/> LIVE SOON</div><div className="live-float float-b"><MessageCircle size={15}/> Join the chat</div></div></div><div className="live-empty"><div className="live-empty-icon"><Radio size={25}/></div><h3>The stage is getting ready.</h3><p>No live streams are listed yet. When creators start broadcasting with a connected streaming provider, they’ll show up here.</p></div></div>
}
function ExplorePanel({onPick}:{onPick:(q:string)=>void}) {
  const topics=[{name:'Music & sound',tag:'Music',emoji:'♫',color:'pink',count:'Fresh sounds'},{name:'Comedy',tag:'Comedy',emoji:'✳',color:'orange',count:'Make yourself laugh'},{name:'Learn something',tag:'Education',emoji:'↗',color:'blue',count:'Ideas worth keeping'},{name:'Travel diaries',tag:'Travel',emoji:'◎',color:'green',count:'Somewhere new'},{name:'Food & culture',tag:'Food',emoji:'✦',color:'yellow',count:'A taste of everywhere'},{name:'Art & design',tag:'Art',emoji:'✳',color:'purple',count:'Made by humans'}];
  return <div className="explore-page"><div className="explore-intro"><span className="eyebrow"><span className="eyebrow-line"/> FIND YOUR CORNER</span><h2>Curiosity looks good on you.</h2><p>Pick a path. See where it takes you.</p></div><div className="topic-grid">{topics.map(t=><button className={`topic-card ${t.color}`} key={t.tag} onClick={()=>onPick(t.tag)}><span className="topic-emoji">{t.emoji}</span><span className="topic-count">{t.count}</span><strong>{t.name}</strong><span className="topic-arrow">↗</span></button>)}</div><div className="explore-bottom"><Sparkles size={17}/><span>Your For You feed learns from your interests and feedback. You stay in control.</span></div></div>
}
export default App;
