// Stats included with each app from /api/microapps/apps and /api/collection/user/apps
export type AppStats = {
    sessions: number;
    unique_users: number;
    total_credits: number;
    avg_credits_session: number;
};

// App types
export type AppSerialized = {
    id: number;
    hashId: string;
    title: string;
    explanation: string;
    privacy: string;
    temperature: number;
    copyAllowed: boolean;
    appJson: string;
    collectionId: number;
    role: 'owner' | 'admin';
    stats?: AppStats;
};

export type AppRaw = {
   id: number;
    hash_id: string;
    title: string;
    explanation: string;
    privacy: string;
    temperature: number;
    copy_allowed: boolean;
    app_json: string;
    collection_id: number;
    role: 'owner' | 'admin';
    stats?: AppStats;
};

// Collection types
export type Collection = {
    id: number;
    name: string;
};

// Component prop types
export type ShareModalProps = {
    app: AppSerialized;
    showModal: boolean;
    setShowModal: (showModal: boolean) => void;
    isOwner: boolean;
};