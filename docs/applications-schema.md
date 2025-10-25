# Firestore Schema for Applications

## Collections

### `projects`
Existing collection that stores job/project postings created by employers.

Key fields:
- `title` (string)
- `shortDesc` (string)
- `description` (string)
- `skills` (array<string>)
- `budget`, `deadline`, `location`, `duration`
- `featured` (boolean)
- `ownerEmail` (string)
- `ownerUid` (string, new)
- `createdAt`, `updatedAt`

### `applications`
New top-level collection to manage candidate submissions.

Document ID strategy: `${projectId}_${candidateUid}` to guarantee uniqueness per project/candidate.

Fields:
- `projectId` (string, reference to `projects` doc id)
- `projectTitle` (string) – cached for quick display
- `projectOwnerUid` (string)
- `projectOwnerEmail` (string)
- `candidateUid` (string)
- `candidateEmail` (string)
- `candidateName` (string)
- `status` (string: `pending`, `accepted`, `rejected`)
- `submittedAt` (timestamp)
- `decidedAt` (timestamp|null)
- `decisionBy` (string|null) – uid/email of employer
- `note` (string|null) – optional employer message

### `notifications`
Reuse existing collection for dropdown alerts.

Relevant fields to extend:
- `userId` – target uid
- `type` – e.g. `application-submitted`, `application-accepted`, `application-rejected`
- `title`, `message`, `url`
- `createdAt`
- `read`

## Indexing

Applications queries will use:
- `where('projectOwnerUid','==', employerUid)` + `orderBy('submittedAt','desc')`
- `where('candidateUid','==', userUid)` + `orderBy('submittedAt','desc')`

Add composite indexes for these if Firestore requests them.

## Security Rules (outline)
- Candidates can create/see their own application docs.
- Employers can update docs where `projectOwnerUid == request.auth.uid`.
- Notifications remain read-only except by writer backend logic.
