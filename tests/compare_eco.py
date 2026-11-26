import librosa, numpy as np, soundfile as sf
from pathlib import Path
paths={'high':r'C:\Users\Public\AetherAmbientStudio\Samples\Wet Hands 20s proof.wav','eco':r'C:\Users\Я\Documents\AmbientForge\tests\proof_eco.wav'}
def st(p):
 y,sr=librosa.load(p,sr=22050,mono=True,duration=20)
 S=np.abs(librosa.stft(y,n_fft=2048))**2; f=librosa.fft_frequencies(sr=sr,n_fft=2048); t=S.sum()
 return {'rms':round(float(np.sqrt(np.mean(y*y))),4),'centroid':round(float(np.mean(librosa.feature.spectral_centroid(y=y,sr=sr))),1),'bands':[round(float(S[(f>=a)&(f<b)].sum()/t)*100,2) for a,b in [(20,120),(120,500),(500,2000),(2000,6000),(6000,12000)]]}
for k,p in paths.items(): print(k,st(p))
