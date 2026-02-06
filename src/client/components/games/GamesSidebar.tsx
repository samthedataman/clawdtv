import { useState } from 'react';

interface GamesSidebarProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export function GamesSidebar({ onSendMessage, disabled }: GamesSidebarProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [diceResult, setDiceResult] = useState<number[]>([]);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);

  // Dice game
  const rollDice = (count: number = 2) => {
    if (disabled) return;
    const results: number[] = [];
    for (let i = 0; i < count; i++) {
      results.push(Math.floor(Math.random() * 6) + 1);
    }
    setDiceResult(results);
    const total = results.reduce((a, b) => a + b, 0);
    const diceEmoji = results.map(d => ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][d - 1]).join(' ');
    onSendMessage(`🎲 rolled ${diceEmoji} = ${total}`);
  };

  // Wheel segments
  const wheelSegments = [
    { label: '🎉 JACKPOT', color: '#ff0040', weight: 5 },
    { label: '💎 x3', color: '#bf5af2', weight: 10 },
    { label: '⭐ x2', color: '#00ffff', weight: 20 },
    { label: '✨ x1.5', color: '#00ff41', weight: 25 },
    { label: '😅 Try Again', color: '#6a6a8a', weight: 25 },
    { label: '💀 Bust', color: '#1a1a3e', weight: 15 },
  ];

  const spinWheel = () => {
    if (disabled || isSpinning) return;
    setIsSpinning(true);
    setWheelResult(null);

    // Weighted random selection
    const totalWeight = wheelSegments.reduce((a, b) => a + b.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;
    for (let i = 0; i < wheelSegments.length; i++) {
      random -= wheelSegments[i].weight;
      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }

    // Calculate rotation (multiple spins + land on segment)
    const segmentAngle = 360 / wheelSegments.length;
    const targetAngle = 360 - (selectedIndex * segmentAngle + segmentAngle / 2);
    const spins = 5 + Math.floor(Math.random() * 3);
    const finalRotation = wheelRotation + spins * 360 + targetAngle;

    setWheelRotation(finalRotation);

    // Announce result after spin
    setTimeout(() => {
      const result = wheelSegments[selectedIndex];
      setWheelResult(result.label);
      setIsSpinning(false);
      onSendMessage(`🎰 spun the wheel → ${result.label}`);
    }, 3000);
  };

  // Coin flip
  const flipCoin = () => {
    if (disabled) return;
    const result = Math.random() > 0.5 ? 'HEADS' : 'TAILS';
    onSendMessage(`🪙 flipped a coin → ${result === 'HEADS' ? '👑' : '🦅'} ${result}`);
  };

  // 8-ball
  const shake8Ball = () => {
    if (disabled) return;
    const responses = [
      'It is certain',
      'Without a doubt',
      'Yes definitely',
      'Ask again later',
      'Cannot predict now',
      'Don\'t count on it',
      'My sources say no',
      'Outlook not so good',
      'Very doubtful',
      'Signs point to yes',
    ];
    const result = responses[Math.floor(Math.random() * responses.length)];
    onSendMessage(`🎱 says: "${result}"`);
  };

  // Rock Paper Scissors
  const playRPS = () => {
    if (disabled) return;
    const choices = ['🪨 Rock', '📄 Paper', '✂️ Scissors'];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    onSendMessage(`✊ throws ${choice}!`);
  };

  const diceDisplay = (value: number) => {
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return faces[value - 1] || '?';
  };

  return (
    <div className="w-64 bg-gh-bg-secondary border-l border-gh-border flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gh-border">
        <h3 className="text-gh-accent-cyan font-bold text-sm flex items-center gap-2">
          <span>🎮</span> Chat Games
        </h3>
        <p className="text-xs text-gh-text-secondary mt-1">Play with chat!</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Dice Game */}
        <div className="bg-gh-bg-tertiary border border-gh-border p-3">
          <h4 className="text-gh-text-primary font-medium text-sm mb-2">🎲 Dice</h4>
          <div className="flex items-center justify-center gap-2 mb-3 h-12">
            {diceResult.length > 0 ? (
              diceResult.map((d, i) => (
                <span key={i} className="text-3xl">{diceDisplay(d)}</span>
              ))
            ) : (
              <span className="text-gh-text-secondary text-sm">Roll to play!</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => rollDice(1)}
              disabled={disabled}
              className="flex-1 px-2 py-1.5 bg-gh-accent-purple/20 border border-gh-accent-purple/50 text-gh-accent-purple text-xs hover:bg-gh-accent-purple/30 disabled:opacity-50 transition-colors"
            >
              1 Die
            </button>
            <button
              onClick={() => rollDice(2)}
              disabled={disabled}
              className="flex-1 px-2 py-1.5 bg-gh-accent-purple/20 border border-gh-accent-purple/50 text-gh-accent-purple text-xs hover:bg-gh-accent-purple/30 disabled:opacity-50 transition-colors"
            >
              2 Dice
            </button>
          </div>
        </div>

        {/* Spin the Wheel */}
        <div className="bg-gh-bg-tertiary border border-gh-border p-3">
          <h4 className="text-gh-text-primary font-medium text-sm mb-2">🎰 Spin the Wheel</h4>
          <div className="relative w-full aspect-square mb-3">
            {/* Wheel */}
            <div
              className="w-full h-full rounded-full border-4 border-gh-accent-cyan overflow-hidden transition-transform duration-[3000ms] ease-out"
              style={{ transform: `rotate(${wheelRotation}deg)` }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {wheelSegments.map((seg, i) => {
                  const angle = 360 / wheelSegments.length;
                  const startAngle = i * angle - 90;
                  const endAngle = startAngle + angle;
                  const x1 = 50 + 50 * Math.cos((startAngle * Math.PI) / 180);
                  const y1 = 50 + 50 * Math.sin((startAngle * Math.PI) / 180);
                  const x2 = 50 + 50 * Math.cos((endAngle * Math.PI) / 180);
                  const y2 = 50 + 50 * Math.sin((endAngle * Math.PI) / 180);
                  const largeArc = angle > 180 ? 1 : 0;
                  return (
                    <path
                      key={i}
                      d={`M50,50 L${x1},${y1} A50,50 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={seg.color}
                    />
                  );
                })}
              </svg>
            </div>
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 text-2xl">
              ▼
            </div>
          </div>
          {wheelResult && (
            <div className="text-center text-sm text-gh-accent-green font-bold mb-2">
              {wheelResult}
            </div>
          )}
          <button
            onClick={spinWheel}
            disabled={disabled || isSpinning}
            className="w-full px-3 py-2 bg-gh-accent-cyan/20 border border-gh-accent-cyan/50 text-gh-accent-cyan text-sm font-medium hover:bg-gh-accent-cyan/30 disabled:opacity-50 transition-colors"
          >
            {isSpinning ? 'Spinning...' : 'SPIN!'}
          </button>
        </div>

        {/* Quick Games */}
        <div className="bg-gh-bg-tertiary border border-gh-border p-3">
          <h4 className="text-gh-text-primary font-medium text-sm mb-2">⚡ Quick Games</h4>
          <div className="space-y-2">
            <button
              onClick={flipCoin}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gh-accent-orange/20 border border-gh-accent-orange/50 text-gh-accent-orange text-sm hover:bg-gh-accent-orange/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>🪙</span> Flip Coin
            </button>
            <button
              onClick={shake8Ball}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gh-accent-purple/20 border border-gh-accent-purple/50 text-gh-accent-purple text-sm hover:bg-gh-accent-purple/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>🎱</span> Magic 8-Ball
            </button>
            <button
              onClick={playRPS}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gh-accent-green/20 border border-gh-accent-green/50 text-gh-accent-green text-sm hover:bg-gh-accent-green/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>✊</span> Rock Paper Scissors
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gh-border">
        <p className="text-[10px] text-gh-text-secondary text-center">
          Results appear in chat for everyone!
        </p>
      </div>
    </div>
  );
}

// Toggle button for header
export function GamesToggleButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1.5 text-sm font-medium transition-colors ${
        isOpen
          ? 'bg-gh-accent-cyan/30 border border-gh-accent-cyan text-gh-accent-cyan'
          : 'bg-gh-bg-tertiary border border-gh-border text-gh-text-secondary hover:text-gh-text-primary hover:border-gh-text-secondary'
      }`}
      title="Chat Games"
    >
      <span>🎮</span>
      <span className="hidden sm:inline">Games</span>
    </button>
  );
}
