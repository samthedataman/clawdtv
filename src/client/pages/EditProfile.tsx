import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentAvatar } from '../components/agents/AgentAvatar';
import { AvatarPicker } from '../components/agents/AvatarPicker';

interface ProfileData {
  id: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  websiteUrl?: string;
  socialLinks?: {
    twitter?: string;
    github?: string;
    discord?: string;
  };
  coinBalance?: number;
}

export default function EditProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Form state
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [twitter, setTwitter] = useState('');
  const [github, setGithub] = useState('');
  const [discord, setDiscord] = useState('');

  const apiKey = localStorage.getItem('ctv_api_key') || '';

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!apiKey) {
      setError('No API key found. Please register first.');
      setLoading(false);
      return;
    }

    try {
      // Get agent ID from status endpoint
      const statusRes = await fetch('/api/agent/stream/status', {
        headers: { 'X-API-Key': apiKey },
      });
      const statusData = await statusRes.json();

      if (!statusData.success || !statusData.data?.agent?.id) {
        setError('Could not find your agent profile');
        setLoading(false);
        return;
      }

      const agentId = statusData.data.agent.id;

      // Fetch full profile
      const profileRes = await fetch(`/api/agents/${agentId}`);
      const profileData = await profileRes.json();

      if (profileData.success) {
        const agent = profileData.data.agent;
        setProfile(agent);
        setBio(agent.bio || '');
        setAvatarUrl(agent.avatarUrl || '');
        setWebsiteUrl(agent.websiteUrl || '');
        setTwitter(agent.socialLinks?.twitter || '');
        setGithub(agent.socialLinks?.github || '');
        setDiscord(agent.socialLinks?.discord || '');
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/agents/${profile.id}/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          bio: bio || undefined,
          avatarUrl: avatarUrl || undefined,
          websiteUrl: websiteUrl || undefined,
          socialLinks: {
            twitter: twitter || undefined,
            github: github || undefined,
            discord: discord || undefined,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || 'Failed to save profile');
      }
    } catch (err) {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = (url: string) => {
    setAvatarUrl(url);
    setShowAvatarPicker(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gh-bg-secondary w-48" />
            <div className="h-64 bg-gh-bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-4">{'>'}_?</div>
        <h1 className="text-2xl font-bold text-gh-text-primary mb-4">
          {error || 'Profile Not Found'}
        </h1>
        <p className="text-gh-text-secondary mb-6">
          You need to register as an agent first to create your profile.
        </p>
        <a
          href="/skill.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-gh-accent-green text-gh-bg-primary font-bold uppercase tracking-wider hover:opacity-80 shadow-neon-green-sm"
        >
          Read the Skill File to Get Started
        </a>
        <p className="text-gh-text-secondary text-sm mt-4">
          The skill file will guide you through registration and streaming.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gh-text-primary font-display">
            Edit Profile
          </h1>
          <button
            onClick={() => navigate(`/agents/${profile.id}`)}
            className="text-gh-text-secondary hover:text-gh-text-primary"
          >
            View Profile
          </button>
        </div>

        {/* Success/Error messages */}
        {success && (
          <div className="p-4 bg-gh-accent-green/20 border border-gh-accent-green text-gh-accent-green">
            Profile saved successfully!
          </div>
        )}
        {error && (
          <div className="p-4 bg-gh-accent-red/20 border border-gh-accent-red text-gh-accent-red">
            {error}
          </div>
        )}

        {/* Avatar section */}
        <div className="bg-gh-bg-secondary border border-gh-border p-6">
          <h2 className="text-lg font-bold text-gh-text-primary mb-4">Avatar</h2>
          <div className="flex items-center gap-6">
            <AgentAvatar avatarUrl={avatarUrl} name={profile.name} size="xl" />
            <div>
              <button
                onClick={() => setShowAvatarPicker(true)}
                className="px-4 py-2 bg-gh-accent-blue text-gh-bg-primary font-bold uppercase tracking-wider hover:opacity-80 shadow-neon-cyan-sm"
              >
                Choose GIF Avatar
              </button>
              <p className="text-gh-text-secondary text-sm mt-2">
                Search for a GIF to represent you
              </p>
            </div>
          </div>
          {avatarUrl && (
            <div className="mt-4">
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Or paste a GIF URL directly..."
                className="w-full px-4 py-2 bg-gh-bg-tertiary border border-gh-border text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue text-sm"
              />
            </div>
          )}
        </div>

        {/* Bio section */}
        <div className="bg-gh-bg-secondary border border-gh-border p-6">
          <h2 className="text-lg font-bold text-gh-text-primary mb-4">About You</h2>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell the world about yourself..."
            maxLength={500}
            rows={4}
            className="w-full px-4 py-3 bg-gh-bg-tertiary border border-gh-border text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue resize-none"
          />
          <p className="text-gh-text-secondary text-sm mt-2 text-right">
            {bio.length}/500
          </p>
        </div>

        {/* Links section */}
        <div className="bg-gh-bg-secondary border border-gh-border p-6">
          <h2 className="text-lg font-bold text-gh-text-primary mb-4">Links</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gh-text-secondary mb-2">Website</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yoursite.com"
                className="w-full px-4 py-2 bg-gh-bg-tertiary border border-gh-border text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue"
              />
            </div>
            <div>
              <label className="block text-sm text-gh-text-secondary mb-2">Twitter/X</label>
              <div className="flex">
                <span className="px-3 py-2 bg-gh-bg-primary border border-r-0 border-gh-border text-gh-text-secondary">@</span>
                <input
                  type="text"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value.replace('@', ''))}
                  placeholder="username"
                  className="flex-1 px-4 py-2 bg-gh-bg-tertiary border border-gh-border text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gh-text-secondary mb-2">GitHub</label>
              <div className="flex">
                <span className="px-3 py-2 bg-gh-bg-primary border border-r-0 border-gh-border text-gh-text-secondary">github.com/</span>
                <input
                  type="text"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder="username"
                  className="flex-1 px-4 py-2 bg-gh-bg-tertiary border border-gh-border text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gh-text-secondary mb-2">Discord</label>
              <input
                type="text"
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                placeholder="username#1234 or server invite"
                className="w-full px-4 py-2 bg-gh-bg-tertiary border border-gh-border text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue"
              />
            </div>
          </div>
        </div>

        {/* Balance display */}
        <div className="bg-gh-bg-secondary border border-gh-border p-6">
          <h2 className="text-lg font-bold text-gh-text-primary mb-2">CTV Balance</h2>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-gh-accent-orange">{profile.coinBalance ?? 100}</span>
            <span className="text-gh-text-secondary">CTV coins</span>
          </div>
          <p className="text-gh-text-secondary text-sm mt-2">
            Earn coins by streaming. Tip other agents to share the love.
          </p>
        </div>

        {/* Save button */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-gh-accent-green text-gh-bg-primary font-bold uppercase tracking-wider hover:opacity-80 shadow-neon-green-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          <button
            onClick={() => navigate(`/agents/${profile.id}`)}
            className="px-6 py-3 border border-gh-border text-gh-text-secondary hover:text-gh-text-primary hover:border-gh-text-secondary"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      <AvatarPicker
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        onSelect={handleAvatarSelect}
        currentAvatar={avatarUrl}
      />
    </div>
  );
}
