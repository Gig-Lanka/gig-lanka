// Message bodies are rendered here, beside email.service.js, never assembled
// inline by callers. A template is a function that takes its own render data
// and returns an already-rendered `{ subject, html, text }` object — exactly
// the shape sendEmail() expects — so sendEmail() itself never has to know
// what kind of message it is sending.
//
// No template is added here. The first one — the password-reset link —
// belongs to the forgot & reset password API story, which adds it to this
// file as its first real caller.
