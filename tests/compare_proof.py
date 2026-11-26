import librosa, numpy as np, soundfile as sf, json
from pathlib import Path
orig_path=Path(r'C:\Users\Я\Downloads\2-03. Wet Hands.mp3')
gen_path=Path(r'C:\Users\Я\Documents\AmbientForge\tests\proof_wet_hands.wav')
y,sr=librosa.load(str(orig_path),sr=22050,mono=True,duration=20)
g,sr2=librosa.load(str(gen_path),sr=22050,mono=True,duration=20)
def stats(y,sr):
    rms=float(np.sqrt(np.mean(y**2))); peak=float(np.max(np.abs(y)))
    cent=float(np.mean(librosa.feature.spectral_centroid(y=y,sr=sr)))
    roll=float(np.mean(librosa.feature.spectral_rolloff(y=y,sr=sr,roll_percent=0.85)))
    contrast=librosa.feature.spectral_contrast(y=y,sr=sr)
    chroma=librosa.feature.chroma_cqt(y=y,sr=sr)
    key=librosa.beat.beat_track(y=y,sr=sr)[0]
    onset=librosa.onset.onset_detect(y=y,sr=sr,units='time', backtrack=False)
    bands=[]
    S=np.abs(librosa.stft(y,n_fft=2048))**2; freqs=librosa.fft_frequencies(sr=sr,n_fft=2048)
    total=S.sum()
    for lo,hi in [(20,120),(120,500),(500,2000),(2000,6000),(6000,12000),(12000,22050)]:
        bands.append(float(S[(freqs>=lo)&(freqs<hi)].sum()/total))
    return dict(rms=round(rms,4),peak=round(peak,4),centroid=round(cent,1),rolloff=round(roll,1),tempo=round(float(np.atleast_1d(key)[0]),1),onsets=len(onset),bands=[round(x*100,2) for x in bands],chroma=np.mean(chroma,axis=1))
a=stats(y,sr); b=stats(g,sr2)
print('ORIGINAL',{k:v for k,v in a.items() if k!='chroma'})
print('GENERATED',{k:v for k,v in b.items() if k!='chroma'})
# chroma cosine and correlation, DTW
ca=a['chroma']/np.linalg.norm(a['chroma']); cb=b['chroma']/np.linalg.norm(b['chroma'])
print('chroma_cos',round(float(np.dot(ca,cb)),4))
# frame chroma correlation via DTW
Ca=librosa.feature.chroma_cqt(y=y,sr=sr); Cb=librosa.feature.chroma_cqt(y=g,sr=sr2)
D,wp=librosa.sequence.dtw(X=Ca,Y=Cb,metric='cosine')
sim=1-D[-1,-1]/wp.shape[0]
print('dtw_path',wp.shape,'path_cost',round(float(D[-1,-1]),3),'normalized_sim',round(float(sim),4))
print('keys',librosa.feature.chroma_cqt(y=y,sr=sr).shape)
print('chroma_profile_orig',[round(float(x),3) for x in a['chroma']])
print('chroma_profile_gen ',[round(float(x),3) for x in b['chroma']])



