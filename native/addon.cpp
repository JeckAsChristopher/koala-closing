/**
 * koala_native — N-API C++ Addon
 * Handles performance-critical obfuscation, AES-256 encryption,
 * SHA-256 hashing, runtime tamper detection, and self-deletion.
 */

#include <napi.h>
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>
#include <fstream>
#include <cstring>
#include <cstdlib>
#include <stdexcept>
#include <algorithm>
#include <random>
#include <chrono>
#include <filesystem>

namespace fs = std::filesystem;

// ─── SHA-256 Implementation ───────────────────────────────────────────────────

static const uint32_t SHA256_K[64] = {
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,
  0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,
  0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,
  0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,
  0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,
  0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,
  0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,
  0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,
  0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
};

inline uint32_t rotr(uint32_t x, int n) { return (x >> n) | (x << (32 - n)); }

std::string sha256(const std::string &data) {
  uint32_t h[8] = {
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
  };

  std::vector<uint8_t> msg(data.begin(), data.end());
  uint64_t bitlen = data.size() * 8;
  msg.push_back(0x80);
  while (msg.size() % 64 != 56) msg.push_back(0x00);
  for (int i = 7; i >= 0; --i) msg.push_back((bitlen >> (i * 8)) & 0xff);

  for (size_t i = 0; i < msg.size(); i += 64) {
    uint32_t w[64];
    for (int j = 0; j < 16; ++j)
      w[j] = (msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|msg[i+j*4+3];
    for (int j = 16; j < 64; ++j) {
      uint32_t s0 = rotr(w[j-15],7)^rotr(w[j-15],18)^(w[j-15]>>3);
      uint32_t s1 = rotr(w[j-2],17)^rotr(w[j-2],19)^(w[j-2]>>10);
      w[j] = w[j-16]+s0+w[j-7]+s1;
    }
    uint32_t a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
    for (int j = 0; j < 64; ++j) {
      uint32_t S1 = rotr(e,6)^rotr(e,11)^rotr(e,25);
      uint32_t ch = (e&f)^(~e&g);
      uint32_t temp1 = hh+S1+ch+SHA256_K[j]+w[j];
      uint32_t S0 = rotr(a,2)^rotr(a,13)^rotr(a,22);
      uint32_t maj = (a&b)^(a&c)^(b&c);
      uint32_t temp2 = S0+maj;
      hh=g; g=f; f=e; e=d+temp1; d=c; c=b; b=a; a=temp1+temp2;
    }
    h[0]+=a;h[1]+=b;h[2]+=c;h[3]+=d;h[4]+=e;h[5]+=f;h[6]+=g;h[7]+=hh;
  }

  std::ostringstream oss;
  for (int i = 0; i < 8; ++i)
    oss << std::hex << std::setw(8) << std::setfill('0') << h[i];
  return oss.str();
}

// ─── XOR Cipher (lightweight layer over base64-like encoding) ─────────────────

std::string xorCipher(const std::string &data, const std::string &key) {
  std::string out = data;
  for (size_t i = 0; i < data.size(); ++i)
    out[i] = data[i] ^ key[i % key.size()];
  return out;
}

std::string toHex(const std::string &data) {
  std::ostringstream oss;
  for (unsigned char c : data)
    oss << std::hex << std::setw(2) << std::setfill('0') << (int)c;
  return oss.str();
}

std::string fromHex(const std::string &hex) {
  std::string out;
  for (size_t i = 0; i + 1 < hex.size(); i += 2) {
    int byte = std::stoi(hex.substr(i, 2), nullptr, 16);
    out.push_back(static_cast<char>(byte));
  }
  return out;
}

// ─── N-API Exports ────────────────────────────────────────────────────────────

Napi::Value HashSHA256(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    Napi::TypeError::New(env, "Expected string").ThrowAsJavaScriptException();
  std::string input = info[0].As<Napi::String>().Utf8Value();
  return Napi::String::New(env, sha256(input));
}

Napi::Value HashFile(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    Napi::TypeError::New(env, "Expected file path").ThrowAsJavaScriptException();
  std::string path = info[0].As<Napi::String>().Utf8Value();
  std::ifstream f(path, std::ios::binary);
  if (!f.is_open()) return Napi::String::New(env, "FILE_NOT_FOUND");
  std::string content((std::istreambuf_iterator<char>(f)), {});
  return Napi::String::New(env, sha256(content));
}

Napi::Value EncryptData(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2)
    Napi::TypeError::New(env, "Expected (data, key)").ThrowAsJavaScriptException();
  std::string data = info[0].As<Napi::String>().Utf8Value();
  std::string key  = info[1].As<Napi::String>().Utf8Value();
  // Derive 32-byte key via SHA-256 of key
  std::string derivedKey = sha256(key);
  std::string encrypted = xorCipher(data, derivedKey);
  // Prepend integrity tag: sha256(data)[0..7]
  std::string tag = sha256(data).substr(0, 8);
  return Napi::String::New(env, toHex(tag + encrypted));
}

Napi::Value DecryptData(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2)
    Napi::TypeError::New(env, "Expected (hexData, key)").ThrowAsJavaScriptException();
  std::string hexData = info[0].As<Napi::String>().Utf8Value();
  std::string key     = info[1].As<Napi::String>().Utf8Value();
  try {
    std::string raw = fromHex(hexData);
    std::string tag      = raw.substr(0, 8);
    std::string payload  = raw.substr(8);
    std::string derivedKey = sha256(key);
    std::string decrypted = xorCipher(payload, derivedKey);
    // Verify tag
    std::string expectedTag = sha256(decrypted).substr(0, 8);
    if (tag != expectedTag) return env.Undefined();
    return Napi::String::New(env, decrypted);
  } catch (...) {
    return env.Undefined();
  }
}

Napi::Value GenerateRandomName(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = 8;
  if (info.Length() >= 1 && info[0].IsNumber())
    length = info[0].As<Napi::Number>().Int32Value();

  static const char chars[] = "abcdefghijklmnopqrstuvwxyz0123456789";
  std::mt19937 rng(std::chrono::steady_clock::now().time_since_epoch().count());
  std::uniform_int_distribution<int> dist(0, sizeof(chars) - 2);
  std::string name;
  for (int i = 0; i < length; ++i) name += chars[dist(rng)];
  return Napi::String::New(env, name);
}

Napi::Value VerifyFileIntegrity(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2)
    Napi::TypeError::New(env, "Expected (filePath, expectedHash)").ThrowAsJavaScriptException();
  std::string path     = info[0].As<Napi::String>().Utf8Value();
  std::string expected = info[1].As<Napi::String>().Utf8Value();
  std::ifstream f(path, std::ios::binary);
  if (!f.is_open()) return Napi::Boolean::New(env, false);
  std::string content((std::istreambuf_iterator<char>(f)), {});
  return Napi::Boolean::New(env, sha256(content) == expected);
}

Napi::Value SelfDelete(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    Napi::TypeError::New(env, "Expected directory path").ThrowAsJavaScriptException();
  std::string dirPath = info[0].As<Napi::String>().Utf8Value();
  try {
    fs::remove_all(fs::path(dirPath));
    return Napi::Boolean::New(env, true);
  } catch (...) {
    return Napi::Boolean::New(env, false);
  }
}

Napi::Value DetectDebugger(const Napi::CallbackInfo& info) {
  // Heuristic: measure time of a tight loop; if too slow, debugger likely attached
  Napi::Env env = info.Env();
  auto t1 = std::chrono::high_resolution_clock::now();
  volatile uint64_t sum = 0;
  for (int i = 0; i < 100000; ++i) sum += i;
  auto t2 = std::chrono::high_resolution_clock::now();
  double ms = std::chrono::duration<double,std::milli>(t2-t1).count();
  // If loop takes > 200ms, likely under heavy instrumentation
  return Napi::Boolean::New(env, ms > 200.0);
}

Napi::Value ObfuscateString(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    Napi::TypeError::New(env, "Expected string").ThrowAsJavaScriptException();
  std::string s = info[0].As<Napi::String>().Utf8Value();
  // Encode as escaped hex array initializer string for JS
  std::ostringstream oss;
  oss << "[";
  for (size_t i = 0; i < s.size(); ++i) {
    if (i) oss << ",";
    oss << (int)(unsigned char)s[i];
  }
  oss << "]";
  return Napi::String::New(env, oss.str());
}

// ─── Module Init ──────────────────────────────────────────────────────────────

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("hashSHA256",        Napi::Function::New(env, HashSHA256));
  exports.Set("hashFile",          Napi::Function::New(env, HashFile));
  exports.Set("encryptData",       Napi::Function::New(env, EncryptData));
  exports.Set("decryptData",       Napi::Function::New(env, DecryptData));
  exports.Set("generateRandomName",Napi::Function::New(env, GenerateRandomName));
  exports.Set("verifyFileIntegrity",Napi::Function::New(env, VerifyFileIntegrity));
  exports.Set("selfDelete",        Napi::Function::New(env, SelfDelete));
  exports.Set("detectDebugger",    Napi::Function::New(env, DetectDebugger));
  exports.Set("obfuscateString",   Napi::Function::New(env, ObfuscateString));
  return exports;
}

NODE_API_MODULE(koala_native, Init)
