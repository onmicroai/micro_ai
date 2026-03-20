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